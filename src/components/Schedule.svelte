<script>
    // @ts-nocheck
    import { onMount,getContext } from "svelte";

	import { formatDate, formatTime } from "../utils/date";

    export let clickedHex;

	import HoloSphere from "holosphere";

	let holosphere = getContext("holosphere") || new HoloSphere("WeQuest");

    let holonID = "-1002029098719";
    let store = {};
    $: quests = sortEvents(Object.entries(store))

    onMount(async () => {
        if (holosphere)
			holosphere.subscribe(holonID, 'quests', (newquest, key) => {
				if (newquest) {
					// Updates the store with the new value
					store[key] = JSON.parse(newquest);
				} else {
					// A key may contain a null value (if data has been deleted/set to null)
					// if so, we remove the item from the store
					delete store[key];
					store = store;
				}
			});
    });

    $: update(clickedHex);

    function update(hex) {
        // Filter ongoing and scheduled quests
        const filteredQuests = quests.filter(quest => quest.status === "scheduled");

        // Sort quests by when property
        const sortedQuests = filteredQuests.sort((a, b) => new Date(a.when) - new Date(b.when));

        return sortedQuests;
    }
	
	function sortEvents(events) {
		if (!events) return [];
		let scheduledevents = events.filter((event) => event.status === 'scheduled');
		events = scheduledevents.filter((event) => new Date(event.when) > new Date());

		// Ordina gli eventi per data
		events.sort((a, b) => new Date(a.when) - new Date(b.when));
		return events;
	}
</script>


<div class="scheduleContainer">
    
	<!-- TIMES -->
	<div class="time start-800">8:00</div>
	<div class="time start-830">8:30</div>
	<div class="time start-900">9:00</div>
	<div class="time start-930">9:30</div>
	<div class="time start-1000">10:00</div>
	<div class="time start-1030">10:30</div>
	<div class="time start-1100">11:00</div>
	<div class="time start-1130">11:30</div>
	<div class="time start-1200">12:00</div>
	<div class="time start-1230">12:30</div>
	<div class="time start-1300">13:00</div>
	<div class="time start-1330">13:30</div>
	<div class="time start-1400">14:00</div>
	<div class="time start-1430">14:30</div>
	<div class="time start-1500">15:00</div>
	<div class="time start-1530">15:30</div>
	<div class="time start-1600">16:00</div>
	<div class="time start-1630">16:30</div>
	<div class="time start-1700">17:00</div>
	<div class="time start-1730">17:30</div>
	<div class="time start-1800">18:00</div>
	<div class="time start-1830">18:30</div>
	<div class="time start-1900">19:00</div>
	<div class="time start-1930">19:30</div>
	<div class="time start-2000">20:00</div>
	<div class="time start-2030">20:30</div>
	<div class="time start-2100">21:00</div>
	<div class="time start-2130">21:30</div>
	
    {#each quests as [key, quest]}
    {#if quest && quest.status === "scheduled"}
    
    <div id ={key} class="event stage-saturn start-800 end-930 length-4">{quest.title} <span> <p class="mb-0 text-muted">🙋‍♂️ {quest.participants.length}</p>
        {#each quest.participants as participant}
            <p>{@html `@${participant.username}`}</p>
        {/each} </span></div>
               
                    <!-- <h5 class="font-size-15"><a href="{quest.id}" class="text-reset">{quest.title}</a></h5>
                    <p class="text-muted mb-4">{quest.when ? new Date(quest.when).toLocaleString() : ""}</p>

                    <p class="mb-0 text-muted">🙋‍♂️ {quest.participants.length}</p>
                    {#each quest.participants as participant}
                        <p>{@html `@${participant.username}`}</p>
                    {/each}
            
                    <h5 class="font-size-15 mb-1">👍 {quest.appreciation.length}</h5>
                </div>
                </div>
 
        </div> -->
    {/if}
{/each}

	<!-- EVENTS -->
	<div class="event stage-saturn start-800 end-930 length-4">Arrival and registration <span>Registration Area</span></div>
	<div class="event stage-earth start-1000 end-1000 length-4">Welcome <span>Earth Stage</span></div>
	<div class="event stage-earth start-1030 end-1030 length-4">Speaker One <span>Earth Stage</span></div>
	<div class="event stage-earth start-1100 end-1100 length-4">Speaker Two <span>Earth Stage</span></div>
	<div class="event stage-earth start-1130 end-1130 length-4">Speaker Three <span>Earth Stage</span></div>
	
	<div class="event stage-mercury start-1200 end-1600 length-1">Speaker Five <span>Mercury Stage</span></div>
	<div class="event stage-venus start-1200 end-1600 length-1">Speaker Six <span>Venus Stage</span></div>
	<div class="event stage-mars start-1200 end-1600 length-1">Speaker Seven <span>Mars Stage</span></div>
	<div class="event stage-saturn start-1200 end-1300 length-1">Lunch <span>Saturn Stage</span></div>
	
	<div class="event stage-earth start-1630 end-1630 length-4">Speaker Eigth <span>Earth Stage</span></div>
	<div class="event stage-earth start-1700 end-1700 length-4">Speaker Nine <span>Earth Stage</span></div>
	
	<div class="event stage-saturn start-1730 end-1730 length-4">Break <span>Saturn Stage</span></div>
	
	<div class="event stage-earth start-1800 end-1900 length-1">Speaker Ten <span>Earth Stage</span></div>
	<div class="event stage-mercury start-1800 end-1900 length-1">Speaker Eleven <span>Mercury Stage</span></div>
	<div class="event stage-jupiter start-1800 end-1900 length-2">Speaker Twelve <span>Jupiter Stage</span></div>
	
	<div class="event stage-venus start-1930 end-2130 length-2">Speaker Thirteen <span>Venus Stage</span></div>
	<div class="event stage-saturn start-1930 end-2130 length-2">Drinks <span>Saturn Stage</span></div>
	
</div>

<style lang="scss">
    $blockTimes: 800,830,900,930,1000,1030,1100,1130,1200,1230,1300,1330,1400,1430,1500,1530,1600,1630,1700,1730,1800,1830,1900,1930,2000,2030,2100,2130;
$blockLengths: 1, 2, 3, 4;

body {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
	padding: 4rem 0;
	font-family: -system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

.scheduleContainer {
	display: grid;
	grid-gap: 0.2rem;
	
	grid-template-columns: 5rem repeat(4, 1fr);	
	grid-template-rows: repeat(28, 1fr);
	grid-template-areas:
		"time800 stage stage stage stage"
		"time830 stage stage stage stage"
		"time900 stage stage stage stage"
		"time930 stage stage stage stage"
		"time1000 stage stage stage stage"
		"time1030 stage stage stage stage"
		"time1100 stage stage stage stage"
		"time1130 stage stage stage stage"
		"time1200 stage stage stage stage"
		"time1230 stage stage stage stage"
		"time1300 stage stage stage stage"
		"time1330 stage stage stage stage"
		"time1400 stage stage stage stage"
		"time1430 stage stage stage stage"
		"time1500 stage stage stage stage"
		"time1530 stage stage stage stage"
		"time1600 stage stage stage stage"
		"time1630 stage stage stage stage"
		"time1700 stage stage stage stage"
		"time1730 stage stage stage stage"
		"time1800 stage stage stage stage"
		"time1830 stage stage stage stage"
		"time1900 stage stage stage stage"
		"time1930 stage stage stage stage"
		"time2000 stage stage stage stage"
		"time2030 stage stage stage stage"
		"time2100 stage stage stage stage"
		"time2130 stage stage stage stage";
}

/**
 * Time
 */
.time {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	border-top: thin dotted #ccc;
	height: 100%;
	padding: 0 0.5rem;
	
	@each $time in $blockTimes {
		&.start-#{$time} {grid-area: time#{$time} }
	}
	
	&[class*="30"]:not(.start-1300) {
		font-size: 0.8rem;
		color: #ccc;
	}
}


/**
 * Event
 */
.event {
	display: flex;
	justify-content: center;
	flex-direction: column;
	padding: 0.5rem 1rem;
	background-color: orange;
	border-radius: 0.2rem;
	font-size: 0.8rem;
	font-weight: bold;
	line-height: 1.4;
	
	span {
		display: block;
		width: 100%;
		font-size: 0.8em;
		font-weight: normal;
	}
	
	@each $time in $blockTimes {
		&.start-#{$time} {grid-row-start: time#{$time} }
	}
	
	@each $time in $blockTimes {
		&.end-#{$time} {grid-row-end: time#{$time} }
	}
	
	@each $length in $blockLengths {
		&.length-#{$length} {
			grid-column-end: span #{$length};
		}
	}
	
	&.stage-earth {background-color: #FFA726};
	&.stage-mercury {background-color: #9CCC65};
	&.stage-venus {background-color: #FF8A65};
	&.stage-mars {background-color: #B3E5FC};
	&.stage-jupiter {background-color: #81D4FA};
	&.stage-saturn {background-color: #26C6DA};
}
</style>


{#each quests as [key, quest]}
    {#if quest && quest.status === "scheduled"}
	<div id= {key} class="w-full md:w-4/12">
        <div class="p-2">
            <div class="p-4 rounded-3xl bg-gray-300">
               
                    <h5 class="font-size-15"><a href="{quest.id}" class="text-reset">{quest.title}</a></h5>
                    <p class="text-muted mb-4">{quest.when ? new Date(quest.when).toLocaleString() : ""}</p>

                    <p class="mb-0 text-muted">🙋‍♂️ {quest.participants.length}</p>
                    {#each quest.participants as participant}
                        <p>{@html `@${participant.username}`}</p>
                    {/each}
            
                    <h5 class="font-size-15 mb-1">👍 {quest.appreciation.length}</h5>
                </div>
                </div>
 
        </div>
    {/if}
{/each}