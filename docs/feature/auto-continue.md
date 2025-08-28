# Auto-Continue Feature

The auto-continue feature provides a user-friendly way to automatically proceed with package installation after a configurable countdown when only warnings (not errors) are detected during security auditing.

## Overview

When npq detects security warnings but no errors during package auditing, it automatically starts a countdown timer that allows the installation to proceed without user intervention. This streamlines the workflow for packages that have minor security concerns but are still considered safe to install.

## When Auto-Continue Activates

The auto-continue feature activates when:

1. **Security audit completes** with warnings but **no errors**
2. **At least one warning** is found (if no warnings, installation proceeds immediately)
3. User has **not explicitly chosen** to always prompt for confirmation

## User Experience

### Visual Display

```
Packages with issues found:

 ┌─
 │ >  express@latest
 │
 │ ⚠ Supply Chain Security · Unable to verify provenance: the package was published without any attestations 
 └─

Summary:

 - Total packages: 1
 - Total errors:   0
 - Total warnings: 1

(press 'y' to proceed with install)
Auto-continue with install in... 15
```

The countdown displays the remaining seconds, updating in real-time by using backspace characters to overwrite the previous number. An instruction message is shown above the countdown to inform users they can press 'y' to proceed immediately.

### Countdown Behavior

- **Default Duration**: 15 seconds
- **Real-time Updates**: Numbers count down from 15 to 1
- **Smart Padding**: Handles transitions from double-digit to single-digit numbers cleanly
- **Clean Display**: Keystrokes during countdown are ignored to prevent visual corruption

## User Interaction Options

### During Countdown

| Action | Behavior | Exit Code |
|--------|----------|-----------|
| **Wait** | Installation proceeds automatically after countdown | `0` (success) |
| **Press 'y' or 'Y'** | Skips countdown and proceeds immediately with installation | `0` (success) |
| **Ctrl+C** | Aborts installation immediately | `1` (user abort) |
| **Other Keys** | Ignored (no visual output) | - |

### Graceful Abortion

When users press `Ctrl+C` during the countdown:

1. **Immediate Response**: Countdown stops instantly
2. **Clean Exit**: No error stack trace displayed
3. **Proper Cleanup**: Terminal state restored to normal
4. **Error Handling**: Throws `USER_ABORT` error with exit code `1`

## Technical Implementation

### Core Function

```javascript
autoContinue({ name, message, timeInSeconds = 5 })
```

**Parameters:**
- `name`: Property name for the returned result object
- `message`: Text displayed before the countdown
- `timeInSeconds`: Duration of countdown (default: 5, npq uses 15)

**Returns:**
- `Promise<Object>`: Resolves to `{ [name]: true }` on completion
- **Throws**: `USER_ABORT` error if user presses Ctrl+C

### TTY Detection and Behavior

#### Interactive Terminals (TTY)
- **Stdin Control**: Sets raw mode to capture individual keypresses
- **Keypress Filtering**: Only responds to Ctrl+C (ASCII 3), ignores others
- **Clean Restoration**: Restores normal stdin behavior after completion

#### Non-Interactive Environments
- **Fallback Mode**: Standard countdown without stdin manipulation
- **Test Compatibility**: Works in CI/CD and testing environments
- **Same Visual Output**: Maintains consistent user experience

### Error Handling

```javascript
// Error thrown on Ctrl+C
{
  message: 'Operation aborted by user',
  code: 'USER_ABORT',
  exitCode: 1
}
```

## Configuration

Currently, the auto-continue feature uses hardcoded values:

- **Countdown Duration**: 15 seconds (defined in `bin/npq.js` and `bin/npq-hero.js`)
- **Trigger Condition**: Warnings > 0 and Errors = 0
- **Message**: "Auto-continue with install in... "

## Usage Context

### In npq Workflow

1. **Package Analysis**: Security marshalls check package safety
2. **Result Evaluation**: 
   - **Errors > 0**: Manual prompt ("Continue install?")
   - **Warnings > 0, Errors = 0**: Auto-continue countdown
   - **No Issues**: Immediate installation
3. **User Decision**: During countdown, user can abort or let it proceed

### Integration Points

- **Main Binary**: `bin/npq.js` (line ~109)
- **Hero Mode**: `bin/npq-hero.js` (line ~83)
- **Implementation**: `lib/helpers/cliPrompt.js`

### Recent Improvements

### "Y" Key Skip Feature

**Enhancement**: Users can now press 'y' or 'Y' during the countdown to immediately proceed with installation without waiting for the timer to complete.

**Benefits**:
- Faster workflow for users who want to proceed immediately
- Clear instruction displayed above countdown
- Maintains all existing functionality (Ctrl+C abort, automatic completion)

### Keystroke Interference Fix

**Problem**: Previously, typing during countdown would display characters and corrupt the countdown display (e.g., `11311187^C%`).

**Solution**: 
- Raw mode stdin capture prevents character echo
- Keypress filtering ignores non-control characters
- Clean countdown display maintained

### Enhanced Ctrl+C Handling

**Problem**: Ctrl+C during countdown caused TypeError crashes.

**Solution**:
- Proper signal handling with graceful error throwing
- Consistent error codes and messaging
- Clean terminal state restoration

## Future Enhancements

Potential improvements could include:

- **Configurable Duration**: Allow users to set countdown time via CLI flags or config
- **Sound Notifications**: Optional audio alerts during countdown
- **Custom Messages**: Configurable countdown messages
- **Additional Skip Keys**: Support for other keys like Enter or Space to proceed
- **Visual Indicators**: Progress bars or other visual countdown representations

## Testing

The auto-continue feature includes comprehensive test coverage:

- **Normal Operation**: Countdown completion and result return
- **User Abortion**: Ctrl+C handling and error throwing
- **Edge Cases**: Various countdown durations and parameter combinations
- **Environment Support**: Both TTY and non-TTY environment testing

See `__tests__/cliPrompt.test.js` for complete test scenarios.
