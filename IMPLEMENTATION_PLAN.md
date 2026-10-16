# Rizz App - Complete Implementation Plan
**Date:** 2026-10-16
**Status:** In Progress

## Priority 1: Story Editor Responsive Fixes (CRITICAL)

### Issues to Fix:
1. Canvas oversized on mobile
2. Photo placeholders extending beyond canvas
3. Clipped borders and labels
4. Different layout between template and editor
5. Toolbar not scrollable
6. Viewport height issues

### Implementation:
```css
/* Responsive canvas container */
.story-canvas-container {
  max-width: min(calc(100vw - 1rem), 640px);
  max-height: calc(100dvh - 8rem);
  aspect-ratio: 9 / 16;
}

/* Photo placeholders stay within bounds */
.photo-placeholder {
  position: absolute;
  /* Use percentages within parent bounds */
  max-width: 100%;
  max-height: 100%;
}

/* Scrollable toolbar */
.story-toolbar {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
```

## Priority 2: Add Music & Games to Realms

### Files to Modify:
- `/root/rizz/src/routes/_app/r.$slug.tsx` - Add music/game buttons to realm header
- Pass `channelId` prop to MusicPlayer and GameLauncher
- Enable shared sessions in voice channels

### Code:
```tsx
// In realm header, add:
<Button onClick={() => setMusicPlayerOpen(true)}>
  <Music2 className="h-5 w-5" />
</Button>
<Button onClick={() => setGameLauncherOpen(true)}>
  <Gamepad2 className="h-5 w-5" />
</Button>

// At component end:
<MusicPlayer 
  open={musicPlayerOpen} 
  onOpenChange={setMusicPlayerOpen}
  channelId={realmId}
/>
<GameLauncher 
  open={gameLauncherOpen} 
  onOpenChange={setGameLauncherOpen}
  channelId={realmId}
/>
```

## Priority 3: Fix X Button / Double X Bug

### Issue:
- Multiple close buttons appearing in overlays
- FullScreenLayer showing duplicate X

### Fix:
- Use single CloseButton component
- Remove redundant X from FullScreenLayer
- Proper z-index management

## Priority 4: Voice Activities Improvements

### Enhancements:
- Better voice controls in realm header
- Activity indicators for music/games
- Join active sessions with one click
- Toast notifications for activities

## Priority 5: Music Search Enhancement

### Already Implemented:
- ✅ Search bar in music player
- ✅ Category filtering
- ✅ Real-time search results

### Status: COMPLETE

## Priority 6: Rizz Branding Improvements

### Changes:
- Consistent brand colors (#c8ff3d primary)
- Bricolage Grotesque font family
- Logo prominence
- Branded UI elements

## Timeline:
- Story Editor Fixes: 30 minutes
- Music/Games in Realms: 20 minutes
- X Button Fix: 10 minutes
- Voice Improvements: 15 minutes
- Branding: 10 minutes

**Total Estimated Time: 85 minutes**

## Next Actions:
1. Fix StoryComposer responsive CSS
2. Add music/game integration to realms
3. Test on mobile viewport
4. Push to GitHub
5. Verify all features work
