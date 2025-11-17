<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { getCurrentLunarInfo, getNextPhaseDate, type LunarInfo } from '../utils/lunarCalendar';

    export let showLunarCalendar: boolean = true;
    export let showResourceFlows: boolean = true;

    let lunarInfo: LunarInfo = getCurrentLunarInfo();
    let updateInterval: number;

    // Update lunar info every hour
    onMount(() => {
        updateInterval = window.setInterval(() => {
            lunarInfo = getCurrentLunarInfo();
        }, 1000 * 60 * 60); // Update every hour
    });

    onDestroy(() => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });

    // Calculate progress percentage for visual bar
    $: progressPercentage = (lunarInfo.daysSinceNew / 29.53) * 100;

    // Get next new moon and full moon dates
    $: nextNewMoon = getNextPhaseDate('new');
    $: nextFullMoon = getNextPhaseDate('full');

    function formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
</script>

{#if showLunarCalendar}
<div class="lunar-calendar-overlay">
    <div class="lunar-card">
        <!-- Moon Phase Icon -->
        <div class="moon-phase-display">
            <div class="moon-emoji">{lunarInfo.emoji}</div>
            <div class="moon-phase-text">{lunarInfo.phaseName}</div>
        </div>

        <!-- Lunar Cycle Progress -->
        <div class="lunar-progress">
            <div class="progress-bar">
                <div
                    class="progress-fill"
                    style="width: {progressPercentage}%"
                ></div>
            </div>
            <div class="progress-label">
                Day {Math.round(lunarInfo.daysSinceNew)} of 29
            </div>
        </div>

        <!-- Illumination Display -->
        <div class="illumination-display">
            <span class="illumination-label">Illumination</span>
            <span class="illumination-value">{Math.round(lunarInfo.illumination * 100)}%</span>
        </div>

        <!-- Half Moon Exchange Indicator -->
        {#if lunarInfo.isHalfMoon}
        <div class="exchange-time-alert">
            <div class="exchange-icon">🔄</div>
            <div class="exchange-text">
                <strong>Exchange Time!</strong>
                <div class="exchange-subtext">
                    Half moon - New Mooners ↔ Full Mooners exchange their work
                </div>
            </div>
        </div>
        {/if}

        <!-- Upcoming Phases -->
        <div class="upcoming-phases">
            <div class="upcoming-phase">
                <span class="phase-icon">🌑</span>
                <span class="phase-date">New: {formatDate(nextNewMoon)}</span>
            </div>
            <div class="upcoming-phase">
                <span class="phase-icon">🌕</span>
                <span class="phase-date">Full: {formatDate(nextFullMoon)}</span>
            </div>
        </div>

        <!-- Cycle Info -->
        <div class="cycle-info">
            <div class="cycle-name">{lunarInfo.currentCycleName}</div>
        </div>
    </div>
</div>
{/if}

<style>
    .lunar-calendar-overlay {
        position: absolute;
        bottom: 20px;
        left: 20px;
        z-index: 10;
        pointer-events: none;
    }

    .lunar-card {
        background: linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(31, 41, 55, 0.92) 100%);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border-radius: 20px;
        padding: 16px 20px;
        box-shadow:
            0 10px 40px rgba(0, 0, 0, 0.4),
            0 4px 12px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.1);
        pointer-events: auto;
        min-width: 280px;
        max-width: 320px;
    }

    .moon-phase-display {
        text-align: center;
        margin-bottom: 12px;
    }

    .moon-emoji {
        font-size: 48px;
        line-height: 1;
        margin-bottom: 8px;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .moon-phase-text {
        font-size: 16px;
        font-weight: 700;
        color: #f9fafb;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    .lunar-progress {
        margin-bottom: 12px;
    }

    .progress-bar {
        width: 100%;
        height: 8px;
        background: rgba(55, 65, 81, 0.5);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 6px;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4a5899 0%, #8ba3e3 100%);
        border-radius: 4px;
        transition: width 0.3s ease;
        box-shadow: 0 0 8px rgba(139, 163, 227, 0.4);
    }

    .progress-label {
        font-size: 12px;
        color: #9ca3af;
        text-align: center;
    }

    .illumination-display {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(55, 65, 81, 0.4);
        border-radius: 8px;
        margin-bottom: 12px;
    }

    .illumination-label {
        font-size: 13px;
        color: #9ca3af;
    }

    .illumination-value {
        font-size: 14px;
        font-weight: 600;
        color: #f9fafb;
    }

    .exchange-time-alert {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 10px 12px;
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 10px;
        margin-bottom: 12px;
        animation: pulseGlow 2s ease-in-out infinite;
    }

    @keyframes pulseGlow {
        0%, 100% {
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
        }
        50% {
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
        }
    }

    .exchange-icon {
        font-size: 24px;
        flex-shrink: 0;
    }

    .exchange-text {
        flex: 1;
    }

    .exchange-text strong {
        display: block;
        color: #10b981;
        font-size: 14px;
        margin-bottom: 2px;
    }

    .exchange-subtext {
        font-size: 11px;
        color: #9ca3af;
        line-height: 1.3;
    }

    .upcoming-phases {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 12px;
    }

    .upcoming-phase {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: rgba(55, 65, 81, 0.3);
        border-radius: 8px;
    }

    .phase-icon {
        font-size: 18px;
    }

    .phase-date {
        font-size: 12px;
        color: #f9fafb;
        font-weight: 500;
    }

    .cycle-info {
        text-align: center;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .cycle-name {
        font-size: 11px;
        color: #60a5fa;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
        .lunar-calendar-overlay {
            bottom: 10px;
            left: 10px;
        }

        .lunar-card {
            min-width: 240px;
            max-width: 280px;
            padding: 12px 16px;
        }

        .moon-emoji {
            font-size: 36px;
        }

        .moon-phase-text {
            font-size: 14px;
        }
    }
</style>
