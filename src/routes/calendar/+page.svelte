<script lang="ts">
    import Calendar from '../../components/Calendar.svelte';

    function handleDateSelect(event) {
        const { date, events } = event.detail;
        console.log('Selected date:', date);
        console.log('Events:', events);
    }
</script>

<div class="p-6">
    <Calendar on:dateSelect={handleDateSelect} />
</div> 