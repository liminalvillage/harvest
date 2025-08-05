# Autofocus Implementation Guide

## Overview

This guide ensures that all input fields across the application automatically receive focus when their containers are opened, allowing users to immediately start typing and hit Enter to proceed.

## Implementation

### 1. Import the Focus Utility

```typescript
import { focusOnMount } from '../utils/focusUtils';
```

### 2. Apply to Input Fields

Replace `autofocus` attributes with the custom action:

```svelte
<!-- Before -->
<input type="text" autofocus />

<!-- After -->
<input type="text" use:focusOnMount />
```

### 3. Enhanced Version with Enter Key

For inputs that should submit on Enter:

```svelte
<input 
  type="text" 
  use:focusOnMountWithEnter={handleSubmit}
  placeholder="Type and press Enter..."
/>
```

## Current Implementation Status

### ✅ Completed Components

1. **Council Component** (`src/components/Council.svelte`)
   - ✅ Ritual wish statement textarea
   - ✅ Value entry input field
   - ✅ Advisor name input field
   - ✅ Advisor lens input field
   - ✅ Circle editing input (advisor name entry)

2. **MyHolons Component** (`src/components/MyHolons.svelte`)
   - ✅ Holon ID input field
   - ✅ Display name input field

3. **AIChatModal Component** (`src/components/AIChatModal.svelte`)
   - ✅ Chat input field

### 🔧 Utility Functions

**File:** `src/utils/focusUtils.ts`

```typescript
// Basic autofocus
export function focusOnMount(node: HTMLElement) {
  node.focus();
  setTimeout(() => node.focus(), 100);
  return { destroy() {} };
}

// Autofocus with Enter key submission
export function focusOnMountWithEnter(node: HTMLElement, callback: () => void) {
  node.focus();
  setTimeout(() => node.focus(), 100);
  
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      callback();
    }
  };
  
  node.addEventListener('keydown', handleKeydown);
  return { destroy() { node.removeEventListener('keydown', handleKeydown); } };
}
```

## Best Practices for New Workflows

### 1. Always Use the Custom Action

```svelte
<!-- ✅ Correct -->
<input type="text" use:focusOnMount />

<!-- ❌ Avoid -->
<input type="text" autofocus />
```

### 2. Handle Enter Key Submission

```svelte
<input 
  type="text" 
  use:focusOnMountWithEnter={handleSubmit}
  placeholder="Type and press Enter..."
/>
```

### 3. For Dynamic Content

The custom action handles dynamic rendering with a 100ms delay, but for complex cases:

```svelte
{#if showModal}
  <input 
    type="text" 
    use:focusOnMount 
    bind:value={inputValue}
  />
{/if}
```

### 4. For Multiple Inputs

Focus the most important input first:

```svelte
<div class="form">
  <input type="text" use:focusOnMount placeholder="Primary field" />
  <input type="text" placeholder="Secondary field" />
</div>
```

## Testing Checklist

When implementing autofocus in new workflows:

- [ ] Input field receives focus immediately when modal/container opens
- [ ] Input field receives focus after dynamic content loads
- [ ] Enter key works as expected (if applicable)
- [ ] Focus works across different browsers
- [ ] Focus works on mobile devices
- [ ] No console errors related to focus

## Common Issues and Solutions

### Issue: Focus not working on dynamic content
**Solution:** The custom action includes a 100ms delay to handle dynamic rendering

### Issue: Multiple inputs competing for focus
**Solution:** Only apply `use:focusOnMount` to the primary input field

### Issue: Enter key not working
**Solution:** Use `focusOnMountWithEnter` instead of `focusOnMount`

### Issue: Focus lost after state changes
**Solution:** Ensure the input element is stable and not being recreated

## Migration Guide

To update existing components:

1. Import the utility:
   ```typescript
   import { focusOnMount } from '../utils/focusUtils';
   ```

2. Replace autofocus attributes:
   ```svelte
   <!-- Find -->
   <input autofocus />
   
   <!-- Replace with -->
   <input use:focusOnMount />
   ```

3. Test thoroughly in the specific workflow

## Future Enhancements

- [ ] Add focus management for complex forms
- [ ] Add focus restoration after modal closes
- [ ] Add keyboard navigation support
- [ ] Add focus indicators for accessibility

## Notes

- The custom action is more reliable than the native `autofocus` attribute
- Works consistently across different browsers and devices
- Handles dynamic content rendering delays
- Provides better user experience for keyboard users 