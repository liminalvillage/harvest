<script lang="ts">
  import { onMount, onDestroy, getContext } from 'svelte';
  import type HoloSphere from 'holosphere';

  export let roomId: string; // This is the holon ID - the name of the room

  let localVideoElement: HTMLVideoElement;
  let remoteVideos = new Map<string, HTMLVideoElement>();
  let localStream: MediaStream | null = null;
  let peerConnections = new Map<string, RTCPeerConnection>();
  let remoteStreams = new Map<string, MediaStream>();
  
  let myUserId = `user_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  let connectedPeers: string[] = [];
  let isAudioEnabled = true;
  let isVideoEnabled = true;
  let connectionStatus = 'Connecting...';
  let gun: any;
  let debugLogs: string[] = [];
  let showDebug = false;

  function addDebugLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    debugLogs = [`${timestamp}: ${message}`, ...debugLogs.slice(0, 19)]; // Keep last 20 logs
    console.log(message);
  }

  function testGunSync() {
    if (!gun) {
      addDebugLog('❌ Gun not available');
      return;
    }

    const roomKey = `vroom_${roomId}`;
    const testMsg = {
      from: myUserId.substring(0, 8),
      message: 'Hello from tab',
      timestamp: Date.now()
    };

    addDebugLog('🧪 Sending test message via Gun');
    gun.get(roomKey).get('test_messages').get(myUserId).put(testMsg);

    // Listen for test messages from others
    gun.get(roomKey).get('test_messages').map().on((data: any, senderId: string) => {
      if (data && data.from && data.from !== myUserId.substring(0, 8)) {
        addDebugLog(`📨 Test message from: ${data.from}`);
      }
    });

    // Also check current users in room
    setTimeout(() => {
      gun.get(roomKey).get('users').once((allUsers: any) => {
        if (allUsers) {
          const userIds = Object.keys(allUsers);
          addDebugLog(`👥 Found ${userIds.length} users: ${userIds.map(id => id.substring(0, 8)).join(', ')}`);
        }
      });
    }, 1000);
  }

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Get holosphere context
  let holosphere: HoloSphere;
  try {
    holosphere = getContext('holosphere');
    gun = holosphere?.gun;
  } catch (e) {
    console.error('Failed to get holosphere context');
  }

  onMount(async () => {
    console.log(`Starting video call in room: ${roomId} as user: ${myUserId}`);
    
    if (!gun) {
      connectionStatus = 'Error: No connection available';
      addDebugLog('❌ Gun instance not available from HoloSphere');
      return;
    }

    addDebugLog(`✅ Gun instance available: ${typeof gun}`);
    
    // Test Gun basic functionality
    const testKey = `test_${Date.now()}`;
    gun.get(testKey).put({test: 'basic connectivity'});
    gun.get(testKey).once((data: any) => {
      addDebugLog(`🔧 Gun basic test: ${data ? 'working' : 'failed'}`);
    });

    try {
      // Get local video stream first
      await initLocalVideo();
      
      // Join the room
      await joinRoom();
      
      connectionStatus = 'Connected';
    } catch (error) {
      console.error('Failed to initialize video call:', error);
      connectionStatus = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  });

  async function initLocalVideo() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (localVideoElement) {
        localVideoElement.srcObject = localStream;
      }
      
      console.log('Local video stream initialized');
    } catch (error) {
      console.error('Failed to get local media:', error);
      throw new Error('Camera/microphone access denied');
    }
  }

  async function joinRoom() {
    // Use a simpler data structure that works better with Gun
    const roomKey = `vroom_${roomId}`;
    
    addDebugLog(`🚪 Joining room key: ${roomKey}`);
    
    // Announce presence using a flat structure
    const myPresence = {
      userId: myUserId,
      online: true,
      joinedAt: Date.now(),
      roomId: roomId
    };
    
    // Put our presence directly on the room node
    gun.get(roomKey).get('users').get(myUserId).put(myPresence);
    addDebugLog(`📝 Announced presence for ${myUserId.substring(0, 12)}`);

    // Listen for all users in the room
    gun.get(roomKey).get('users').map().on((userData: any, userId: string) => {
      addDebugLog(`👥 User update: ${userId?.substring(0, 12)} - ${userData ? 'present' : 'gone'}`);
      
      if (userData && userData.online && userData.userId !== myUserId) {
        if (!peerConnections.has(userData.userId)) {
          addDebugLog(`✨ New peer discovered: ${userData.userId.substring(0, 12)}`);
          connectToPeer(userData.userId);
        }
      } else if (!userData && userId !== myUserId) {
        if (peerConnections.has(userId)) {
          addDebugLog(`👋 Peer left: ${userId.substring(0, 12)}`);
          disconnectFromPeer(userId);
        }
      }
    });

    // Set up signaling listener
    gun.get(roomKey).get('signals').get(myUserId).map().on((message: any, msgId: string) => {
      if (message && message.from && message.from !== myUserId) {
        addDebugLog(`📨 Signal from ${message.from.substring(0, 8)}: ${message.type}`);
        handleSignalingMessage(message);
        
        // Clear processed message
        setTimeout(() => {
          gun.get(roomKey).get('signals').get(myUserId).get(msgId).put(null);
        }, 500);
      }
    });

    // Also do periodic user discovery
    const userDiscovery = setInterval(() => {
      gun.get(roomKey).get('users').once((allUsers: any) => {
        const userCount = allUsers ? Object.keys(allUsers).length : 0;
        addDebugLog(`🔍 Periodic scan found ${userCount} total users`);
      });
    }, 5000);

    // Store interval for cleanup
    (window as any).userDiscoveryInterval = userDiscovery;
  }

  async function connectToPeer(peerId: string) {
    if (!localStream) return;

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections.set(peerId, pc);

    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream!);
    });

    // Handle incoming stream
    pc.ontrack = (event) => {
      console.log(`Received remote stream from ${peerId}`);
      if (event.streams[0]) {
        remoteStreams.set(peerId, event.streams[0]);
        updateRemoteVideos();
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage(peerId, 'ice-candidate', event.candidate.toJSON());
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log(`Connection with ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        if (!connectedPeers.includes(peerId)) {
          connectedPeers = [...connectedPeers, peerId];
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        connectedPeers = connectedPeers.filter(p => p !== peerId);
      }
    };

    // Create offer if we should initiate (alphabetically first user initiates)
    if (myUserId.localeCompare(peerId) < 0) {
      console.log(`Initiating connection to ${peerId}`);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignalingMessage(peerId, 'offer', offer);
      } catch (error) {
        console.error(`Error creating offer for ${peerId}:`, error);
      }
    }
  }

  function sendSignalingMessage(toUserId: string, type: string, data: any) {
    const roomKey = `vroom_${roomId}`;
    const messageId = `${myUserId.substring(0, 8)}_${Date.now()}`;
    
    const message = {
      from: myUserId,
      to: toUserId,
      type: type,
      data: data,
      timestamp: Date.now()
    };
    
    addDebugLog(`📤 Sending ${type} to ${toUserId.substring(0, 8)}`);
    gun.get(roomKey).get('signals').get(toUserId).get(messageId).put(message);
  }

  async function handleSignalingMessage(message: any) {
    const { from: fromUserId, type, data } = message;
    
    if (!fromUserId || fromUserId === myUserId) {
      console.log('Ignoring invalid or self message');
      return;
    }

    let pc = peerConnections.get(fromUserId);

    if (!pc) {
      console.log(`No peer connection for ${fromUserId}, creating one for incoming ${type}`);
      await connectToPeer(fromUserId);
      pc = peerConnections.get(fromUserId);
      
      if (!pc) {
        console.error(`Failed to create peer connection for ${fromUserId}`);
        return;
      }
    }

    try {
      switch (type) {
        case 'offer':
          console.log(`Handling offer from ${fromUserId}`);
          if (pc.signalingState !== 'stable') {
            console.log(`PC not in stable state (${pc.signalingState}), resetting...`);
            pc.close();
            await connectToPeer(fromUserId);
            pc = peerConnections.get(fromUserId);
            if (!pc) return;
          }
          
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignalingMessage(fromUserId, 'answer', answer);
          console.log(`Sent answer to ${fromUserId}`);
          break;

        case 'answer':
          console.log(`Handling answer from ${fromUserId}`);
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            console.log(`Set remote description for ${fromUserId}`);
          } else {
            console.log(`Ignoring answer, signaling state is ${pc.signalingState}`);
          }
          break;

        case 'ice-candidate':
          console.log(`Handling ICE candidate from ${fromUserId}`);
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data));
            console.log(`Added ICE candidate from ${fromUserId}`);
          } else {
            console.log(`Queuing ICE candidate from ${fromUserId} (no remote description yet)`);
            // Could queue candidates here if needed
          }
          break;

        default:
          console.log(`Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`Error handling ${type} from ${fromUserId}:`, error);
      
      // Try to recover by recreating the connection
      if (type === 'offer' || type === 'answer') {
        console.log(`Attempting to recover connection to ${fromUserId}`);
        disconnectFromPeer(fromUserId);
        setTimeout(() => connectToPeer(fromUserId), 1000);
      }
    }
  }

  function disconnectFromPeer(peerId: string) {
    const pc = peerConnections.get(peerId);
    if (pc) {
      pc.close();
      peerConnections.delete(peerId);
    }
    remoteStreams.delete(peerId);
    connectedPeers = connectedPeers.filter(p => p !== peerId);
    updateRemoteVideos();
  }

  function updateRemoteVideos() {
    // Trigger reactive update
    remoteStreams = new Map(remoteStreams);
  }

  function toggleAudio() {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        isAudioEnabled = audioTrack.enabled;
      }
    }
  }

  function toggleVideo() {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        isVideoEnabled = videoTrack.enabled;
      }
    }
  }

  function leaveRoom() {
    // Remove from room
    if (gun) {
      const roomKey = `vroom_${roomId}`;
      gun.get(roomKey).get('users').get(myUserId).put(null);
      addDebugLog(`👋 Left room ${roomId}`);
    }
    
    // Clear discovery interval
    if ((window as any).userDiscoveryInterval) {
      clearInterval((window as any).userDiscoveryInterval);
    }
    
    // Close all peer connections
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Navigate back
    window.history.back();
  }

  onDestroy(() => {
    leaveRoom();
  });

  // Update local video element when stream changes
  $: if (localVideoElement && localStream) {
    localVideoElement.srcObject = localStream;
  }
</script>

<div class="video-container">
  <div class="header">
    <h2>Room: {roomId}</h2>
    <div class="status">{connectionStatus}</div>
    <div class="peer-count">
      {connectedPeers.length} peer{connectedPeers.length !== 1 ? 's' : ''} connected
      {#if peerConnections.size > 0}
        | {peerConnections.size} connection{peerConnections.size !== 1 ? 's' : ''}
      {/if}
    </div>
  </div>

  <div class="videos" class:single={remoteStreams.size === 0} class:grid={remoteStreams.size > 0}>
    <!-- Local Video -->
    <div class="video-wrapper local">
      <video bind:this={localVideoElement} autoplay muted playsinline class:video-off={!isVideoEnabled}>
        <track kind="captions" />
      </video>
      <div class="video-label">You ({myUserId.substring(0, 8)})</div>
      {#if !isVideoEnabled}
        <div class="video-off-indicator">📹</div>
      {/if}
    </div>

    <!-- Remote Videos -->
    {#each Array.from(remoteStreams.entries()) as [peerId, stream] (peerId)}
      <div class="video-wrapper remote">
        <video srcObject={stream} autoplay playsinline>
          <track kind="captions" />
        </video>
        <div class="video-label">Peer ({peerId.substring(0, 8)})</div>
      </div>
    {/each}
  </div>

  <div class="controls">
    <button 
      class="control-btn" 
      class:active={isAudioEnabled}
      on:click={toggleAudio}
    >
      {isAudioEnabled ? '🎤' : '🔇'}
    </button>
    
    <button 
      class="control-btn" 
      class:active={isVideoEnabled}
      on:click={toggleVideo}
    >
      {isVideoEnabled ? '📹' : '📵'}
    </button>
    
    <button class="control-btn leave" on:click={leaveRoom}>
      ❌ Leave
    </button>
    
    <button class="control-btn debug" on:click={() => showDebug = !showDebug}>
      🐛 Debug
    </button>

    <button class="control-btn test" on:click={testGunSync}>
      🧪 Test Gun
    </button>
  </div>

  {#if showDebug}
    <div class="debug-panel">
      <h3>Debug Info</h3>
      <div class="debug-info">
        <p><strong>User ID:</strong> {myUserId}</p>
        <p><strong>Room:</strong> {roomId}</p>
        <p><strong>Peer Connections:</strong> {peerConnections.size}</p>
        <p><strong>Remote Streams:</strong> {remoteStreams.size}</p>
        <p><strong>Connected Peers:</strong> {connectedPeers.join(', ')}</p>
      </div>
      <div class="debug-logs">
        <h4>Recent Logs:</h4>
        {#each debugLogs as log}
          <div class="log-entry">{log}</div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .video-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #000;
    color: white;
  }

  .header {
    padding: 1rem;
    background: rgba(0,0,0,0.8);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #333;
  }

  .header h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .status {
    color: #4ade80;
    font-size: 0.9rem;
  }

  .peer-count {
    color: #94a3b8;
    font-size: 0.9rem;
  }

  .videos {
    flex: 1;
    padding: 1rem;
    display: flex;
    gap: 1rem;
  }

  .videos.single {
    justify-content: center;
    align-items: center;
  }

  .videos.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }

  .video-wrapper {
    position: relative;
    background: #333;
    border-radius: 8px;
    overflow: hidden;
    aspect-ratio: 16/9;
    min-height: 200px;
  }

  .video-wrapper video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-wrapper.local video {
    transform: scaleX(-1); /* Mirror local video */
  }

  .video-wrapper.local video.video-off {
    display: none;
  }

  .video-label {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: rgba(0,0,0,0.7);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .video-off-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 3rem;
    opacity: 0.7;
  }

  .controls {
    display: flex;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(0,0,0,0.8);
  }

  .control-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    background: #374151;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
  }

  .control-btn:hover {
    background: #4b5563;
  }

  .control-btn.active {
    background: #059669;
  }

  .control-btn.leave {
    background: #dc2626;
  }

  .control-btn.leave:hover {
    background: #b91c1c;
  }

  .control-btn.debug {
    background: #8b5cf6;
  }

  .control-btn.debug:hover {
    background: #7c3aed;
  }

  .control-btn.test {
    background: #059669;
  }

  .control-btn.test:hover {
    background: #047857;
  }

  .debug-panel {
    position: absolute;
    top: 60px;
    right: 10px;
    width: 300px;
    background: rgba(0,0,0,0.9);
    border: 1px solid #333;
    border-radius: 8px;
    padding: 1rem;
    font-size: 0.8rem;
    max-height: 400px;
    overflow-y: auto;
    z-index: 1000;
  }

  .debug-panel h3, .debug-panel h4 {
    margin: 0 0 0.5rem 0;
    color: #8b5cf6;
  }

  .debug-info p {
    margin: 0.25rem 0;
    word-break: break-all;
  }

  .debug-logs {
    margin-top: 1rem;
  }

  .log-entry {
    font-family: monospace;
    font-size: 0.7rem;
    padding: 0.25rem;
    border-bottom: 1px solid #333;
    color: #94a3b8;
  }

  @media (max-width: 768px) {
    .videos.grid {
      grid-template-columns: 1fr;
    }
    
    .header {
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-start;
    }

    .controls {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .control-btn {
      flex: 1;
      min-width: 100px;
    }
  }
</style>