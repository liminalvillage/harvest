<script lang="ts">
  import { onMount, onDestroy, getContext } from 'svelte';
  import type HoloSphere from 'holosphere'; // Assuming HoloSphere is a type, adjust if it's a class for instantiation

  // Variables to hold local video element
  let localVideoElement: HTMLVideoElement;
  // Map to hold remote video elements, keyed by peer ID
  // We will dynamically create video elements, so we'll manage remote streams.
  let remoteStreams = new Map<string, MediaStream>();

  // WebRTC related variables
  let peerConnections = new Map<string, RTCPeerConnection>();
  let localStream: MediaStream | null = null;

  // GunDB instance via HoloSphere
  let gun: any; 
  let holosphere: HoloSphere;

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'password' } // Example TURN server
    ]
  };

  let roomName = 'default-multi-room'; // Room name can be made dynamic
  let localUserId = 'user-' + Math.random().toString(36).substring(2, 9);
  console.log(`My localUserId: ${localUserId}`);

  // Function to re-render remote streams (Svelte reactivity helper)
  function updateRemoteStreams() {
    remoteStreams = new Map(remoteStreams);
  }

  async function initializeLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream = stream;
      if (localVideoElement) {
        localVideoElement.srcObject = stream;
      }
      console.log('Local media stream obtained');
    } catch (error) {
      console.error('Error accessing media devices.', error);
    }
  }

  function createPeerConnection(peerId: string): RTCPeerConnection | null {
    if (!localStream) {
      console.error('Local stream not available to create peer connection.');
      return null;
    }
    console.log(`Creating peer connection to ${peerId}`);
    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate && gun) {
        console.log(`Sending ICE candidate to ${peerId}:`, event.candidate);
        gun.get(`rooms/${roomName}/signaling/${peerId}/${localUserId}/iceCandidate`).put({ candidate: event.candidate.toJSON(), fromId: localUserId });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[pc.ontrack] Event received from ${peerId}. Event:`, event);
      if (event.streams && event.streams[0]) {
        console.log(`[pc.ontrack] Stream found for ${peerId}. Stream ID: ${event.streams[0].id}`);
        remoteStreams.set(peerId, event.streams[0]);
        updateRemoteStreams(); // Trigger Svelte reactivity
        console.log(`Remote stream from ${peerId} added.`);
      } else {
         // Fallback for older browsers or specific track events if streams[0] is not available
        if (event.track) {
            let stream = remoteStreams.get(peerId) || new MediaStream();
            stream.addTrack(event.track);
            remoteStreams.set(peerId, stream);
            updateRemoteStreams();
            console.log(`Remote track from ${peerId} added to stream.`);
        }
      }
    };

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream!);
    });

    peerConnections.set(peerId, pc);
    return pc;
  }

  async function handleOffer(offerData: { sdp: RTCSessionDescriptionInit, fromId: string }) {
    const { sdp, fromId } = offerData;
    console.log(`[handleOffer CALLED] fromId: ${fromId}. Offer SDP:`, JSON.parse(JSON.stringify(sdp)));
    if (!gun || fromId === localUserId) return;

    console.log(`Received offer from ${fromId}`);
    let pc: RTCPeerConnection | null | undefined = peerConnections.get(fromId);
    if (!pc) {
      pc = createPeerConnection(fromId);
    }
    if (!pc) {
      console.error(`Failed to create peer connection for offer from ${fromId}`);
      return;
    }

    if (pc.currentRemoteDescription) {
      console.warn(`Offer from ${fromId} received, but remote description already set. Clearing stale offer.`);
      gun.get(`rooms/${roomName}/signaling/${localUserId}/${fromId}/offer`).put(null);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      gun.get(`rooms/${roomName}/signaling/${fromId}/${localUserId}/answer`).put({ sdp: answer, fromId: localUserId });
      console.log(`Sent answer to ${fromId}`);
    } catch (error) {
      console.error(`Error handling offer from ${fromId}:`, error);
    }
  }

  async function handleAnswer(answerData: { sdp: RTCSessionDescriptionInit, fromId: string }) {
    const { sdp, fromId } = answerData;
    console.log(`[handleAnswer CALLED] fromId: ${fromId}. Answer SDP:`, JSON.parse(JSON.stringify(sdp)));
    if (fromId === localUserId) return;

    console.log(`Received answer from ${fromId}`);
    const pc = peerConnections.get(fromId);
    if (pc) {
      if (pc.currentRemoteDescription && pc.signalingState === "have-local-offer") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          console.log(`Remote description set for answer from ${fromId}`);
          gun.get(`rooms/${roomName}/signaling/${localUserId}/${fromId}/answer`).put(null);
        } catch (error) {
          console.error(`Error setting remote description for answer from ${fromId}:`, error);
        }
      } else {
        console.warn(`Received answer from ${fromId}, but not expecting one or already processed. Signaling state: ${pc.signalingState}`);
      }
    } else {
      console.warn(`PeerConnection for ${fromId} not found when handling answer.`);
    }
  }

  async function handleIceCandidate(iceData: { candidate: RTCIceCandidateInit, fromId: string }) {
    const { candidate, fromId } = iceData;
    console.log(`[handleIceCandidate CALLED] fromId: ${fromId}. Candidate:`, JSON.parse(JSON.stringify(candidate)));
    if (fromId === localUserId) return;

    console.log(`Received ICE candidate from ${fromId}`);
    const pc = peerConnections.get(fromId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`Added ICE candidate from ${fromId}`);
      } catch (error) {
        console.error(`Error adding ICE candidate from ${fromId}:`, error);
      }
    } else {
      console.warn(`PeerConnection for ${fromId} not found when trying to add ICE candidate.`);
    }
  }


  onMount(async () => {
    console.log('VideoChat component mounted - Multi-user mode');
    holosphere = getContext<HoloSphere>("holosphere");
    if (holosphere && holosphere.gun) {
      gun = holosphere.gun;
      console.log('Successfully accessed holosphere.gun', gun);
    } else {
      console.error('Failed to access holosphere.gun');
      return; // Cannot proceed without gun
    }

    await initializeLocalMedia();
    if (!localStream) {
        console.error("Local media stream failed to initialize. Cannot proceed.");
        return;
    }

    // Announce presence and discover other participants
    const participantsPath = `rooms/${roomName}/participants`;
    const localParticipantNodePath = `${participantsPath}/${localUserId}`;

    // Announce self - using the gun instance from HoloSphere
    if (gun) { // Check if gun instance is available from HoloSphere
        gun.get(localParticipantNodePath).put({ online: true, joinedAt: Date.now(), id: localUserId });
        console.log(`Announced presence at ${localParticipantNodePath} using holosphere.gun`);
    } else {
        console.error("holosphere.gun instance not available for announcing presence.");
    }
    
    // --- Start Snapshot Debugging (using holosphere.gun) ---
    if (gun) {
        console.log('[SNAPSHOT_DEBUG] Attempting to read local participant data with .once() via holosphere.gun');
        gun.get(localParticipantNodePath).once((data: any) => {
            console.log(`[SNAPSHOT_DEBUG] Local participant data read with .once() via holosphere.gun:`, JSON.parse(JSON.stringify(data || {})));
        });

        console.log('[SNAPSHOT_DEBUG] Attempting to get participants snapshot with .map().once() via holosphere.gun');
        gun.get(participantsPath).map().once((data: { online: boolean, id: string, joinedAt: number } | null, peerId: string) => {
          console.log(`[Participants SNAPSHOT_MAP_ONCE] Peer ID: ${peerId}, Data:`, JSON.parse(JSON.stringify(data || {})));
        });
    } else {
        console.error("holosphere.gun instance not available for snapshot debugging.");
    }
    // --- End Snapshot Debugging ---

    // Listen for other participants (real-time updates) - using holosphere.gun
    if (gun) {
        gun.get(participantsPath).map().on((data: { online: boolean, id: string, joinedAt: number } | null, peerId: string) => {
          console.log(`[Participants Listener RAW] peerId: ${peerId}, data:`, JSON.parse(JSON.stringify(data || {})));

          if (data && data.online && peerId !== localUserId) {
            console.log(`Discovered participant: ${peerId}`, data);
            if (!peerConnections.has(peerId)) {
              if (localUserId < peerId) {
                console.log(`I (${localUserId}) will initiate connection to ${peerId}`);
                const pc = createPeerConnection(peerId);
                if (pc) {
                  pc.createOffer()
                    .then(offer => pc.setLocalDescription(offer).then(() => offer))
                    .then(offer => {
                      gun.get(`rooms/${roomName}/signaling/${peerId}/${localUserId}/offer`).put({ sdp: offer, fromId: localUserId });
                      console.log(`Sent offer to ${peerId}`);
                    })
                    .catch(error => console.error(`Error creating offer for ${peerId}:`, error));
                }
              } else {
                console.log(`${peerId} should initiate connection to me (${localUserId}). Waiting for offer.`);
              }
            }
          } else if (!data || !data.online) {
            if (peerId !== localUserId && peerConnections.has(peerId)) {
              console.log(`Participant ${peerId} appears to have left or data nulled (data: ${JSON.stringify(data || {})}). Cleaning up.`);
              const pc = peerConnections.get(peerId);
              if (pc) pc.close();
              peerConnections.delete(peerId);
              remoteStreams.delete(peerId);
              updateRemoteStreams();
              gun.get(`rooms/${roomName}/signaling/${localUserId}/${peerId}/offer`).off();
              gun.get(`rooms/${roomName}/signaling/${localUserId}/${peerId}/answer`).off();
              gun.get(`rooms/${roomName}/signaling/${localUserId}/${peerId}/iceCandidate`).off();
            }
          }
        });
    } else {
        console.error("holosphere.gun instance not available for participant listener.");
    }

    // Main signaling listener - using direct gun instance from HoloSphere
    if (gun) {
        const signalingMessagesPath = `rooms/${roomName}/signaling/${localUserId}/`;
        gun.get(signalingMessagesPath).map().on((messagesFromSender: any, senderId: string) => {
          if (senderId === localUserId || !messagesFromSender) {
            if (!messagesFromSender && senderId !== localUserId) {
                console.log(`[SIG_MSG_RAW at ${localUserId}] Message node for sender ${senderId} is null.`);
            }
            return;
          }

          console.log(`[SIG_MSG_RAW at ${localUserId}] From ${senderId} in room ${roomName}:`, JSON.parse(JSON.stringify(messagesFromSender)));

          if (messagesFromSender.offer && messagesFromSender.offer.sdp && messagesFromSender.offer.fromId === senderId) {
            console.log(`[SIG_MSG_HANDLER at ${localUserId}] Detected offer from ${senderId}`);
            handleOffer({ sdp: messagesFromSender.offer.sdp, fromId: senderId });
            gun.get(`${signalingMessagesPath}${senderId}/offer`).put(null);
          }

          if (messagesFromSender.answer && messagesFromSender.answer.sdp && messagesFromSender.answer.fromId === senderId) {
            console.log(`[SIG_MSG_HANDLER at ${localUserId}] Detected answer from ${senderId}`);
            handleAnswer({ sdp: messagesFromSender.answer.sdp, fromId: senderId });
            gun.get(`${signalingMessagesPath}${senderId}/answer`).put(null);
          }

          if (messagesFromSender.iceCandidate && messagesFromSender.iceCandidate.candidate && messagesFromSender.iceCandidate.fromId === senderId) {
            console.log(`[SIG_MSG_HANDLER at ${localUserId}] Detected ICE candidate from ${senderId}`);
            handleIceCandidate({ candidate: messagesFromSender.iceCandidate.candidate, fromId: senderId });
          }
        });
        console.log(`Listening for signaling messages for ${localUserId} under ${signalingMessagesPath}`);
    } else {
        console.error("holosphere.gun instance not available for signaling listener.");
    }

    // Log connected peers after initial setup (and potentially on demand later)
    logConnectedPeers();
  });

  function logConnectedPeers() {
    if (peerConnections.size === 0) {
      console.log('[Connected Peers] No peers currently connected.');
      return;
    }
    console.log('[Connected Peers] Currently connected peer IDs:');
    peerConnections.forEach((pc, peerId) => {
      console.log(`  - ${peerId} (Signaling state: ${pc.signalingState}, ICE connection state: ${pc.iceConnectionState})`);
    });
  }

  onDestroy(() => {
    console.log('VideoChat component will be unmounted');
    if (gun) {
      // Announce offline status or remove self
      gun.get(`rooms/${roomName}/participants/${localUserId}`).put(null as any); // Remove self or set offline
      console.log('Removed presence from room.');

      // Clean up all peer connections and their specific listeners
      peerConnections.forEach((pc, peerId) => {
        pc.close();
        // Old paths for cleanup might be incorrect now, adjust if direct peer signaling listeners were set up
        // For the new structure, the main listener is on `rooms/${roomName}/signaling/${localUserId}/`
        // and specific message nodes are nulled out upon processing.
        // We still need to .off() the listeners for messages *from* specific peers if those were set.
        // The main listener will be turned off below.
      });
      peerConnections.clear();
      remoteStreams.clear();
      updateRemoteStreams();

      gun.get(`rooms/${roomName}/participants`).off();
      gun.get(`rooms/${roomName}/signaling/${localUserId}/`).off(); // Main signaling listener cleanup

    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      console.log('Local media stream stopped');
    }
    console.log('Cleanup complete.');
  });

  // For simplicity, removing startCall and endCall buttons for now,
  // as connections are auto-initiated and ended based on presence.
  // A manual "leave room" button might be useful.
</script>

<div class="video-chat-container">
  <h2>Video Chat - Room: {roomName} (My ID: {localUserId})</h2>
  <div class="videos">
    <div class="video-wrapper">
      <h3>My Video</h3>
      <video bind:this={localVideoElement} autoplay muted playsinline>
        <track kind="captions" src="" label="English" srclang="en" default />
      </video>
    </div>
    {#each Array.from(remoteStreams.entries()) as [peerId, stream] (peerId)}
      <div class="video-wrapper">
        <h3>Remote Video ({peerId})</h3>
        <video srcObject={stream} autoplay playsinline>
          <track kind="captions" src="" label="English" srclang="en" default />
        </video>
      </div>
    {/each}
  </div>
  <!-- Controls removed for simplicity in multi-user auto-connect mode -->
</div>

<style>
  .video-chat-container {
    background-color: #f0f2f5; /* Light grey background, common in dashboards */
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Subtle shadow for depth */
    color: #333; /* Darker text for better readability */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .video-chat-container h2 {
    color: #1a202c; /* Darker heading color */
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 1.5em;
    border-bottom: 1px solid #e2e8f0; /* Subtle separator */
    padding-bottom: 10px;
  }

  .videos {
    display: flex;
    flex-wrap: wrap;
    gap: 16px; /* Slightly reduced gap */
    margin-bottom: 20px;
  }

  .video-wrapper {
    flex: 1 1 280px; /* Flex-grow, flex-shrink, and basis for responsiveness */
    /* min-width: 280px; /* Ensure videos are not too small */
    max-width: calc(50% - 8px); /* Max two videos per row, considering gap */
    border: 1px solid #cbd5e0; /* Softer border color */
    background: #ffffff; /* White background for video cards */
    border-radius: 6px; /* Rounded corners for video cards */
    overflow: hidden; /* Ensure video respects border-radius */
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }

  .video-wrapper h3 {
    margin: 0;
    padding: 8px 12px;
    font-size: 0.9em;
    background-color: #e9edf1; /* Lighter header for video cards */
    color: #2d3748; /* Darker text for video titles */
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-bottom: 1px solid #cbd5e0;
  }

  video {
    width: 100%;
    height: auto;
    display: block;
    background-color: #000; /* Black background for video area before stream loads */
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .video-wrapper {
      max-width: calc(100% - 16px); /* Full width on smaller screens, accounting for gap if it wraps weirdly */
      min-width: 200px; /* Adjust min-width for smaller screens if needed */
    }
    .video-chat-container h2 {
        font-size: 1.25em;
    }
  }

</style> 