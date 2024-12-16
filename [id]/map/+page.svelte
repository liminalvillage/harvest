<script lang="ts">
    let isViewingOrEditing = false; // or however you track the view/edit state
</script>

<Map 
    selectedLens={selectedLens}
    on:holonChange={() => {
        isViewingOrEditing = false;
    }} 
/> 