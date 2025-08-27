# Age Marshall Documentation

## Overview

The Age Marshall is a security validation component in NPQ that analyzes package age and maturity to identify potentially risky packages. It performs two main checks:

1. **New Package Detection**: Flags packages that are too new (< 22 days old)
2. **Abandoned Package Detection**: Warns about packages that appear unmaintained (> 365 days old)

## Technical Design

### Architecture

The Age Marshall extends the `BaseMarshall` class and belongs to the `PackageHealth` category. It leverages the npm registry's `time` field to analyze both package creation dates and version release dates.

### Key Components

```javascript
const PACKAGE_AGE_THRESHOLD = 22 // specified in days
const PACKAGE_AGE_UNMAINTAINED_RISK = 365 // specified in days
```

### Data Flow

1. **Package Info Retrieval**: Fetches package metadata from npm registry
2. **Date Extraction**: Extracts `time.created` (package creation) and `time[version]` (version release)
3. **Age Calculation**: Computes time differences using millisecond precision
4. **Threshold Validation**: Compares against configured thresholds
5. **Risk Assessment**: Returns errors for new packages, warnings for old packages

## Critical Bug Fix: Date Calculation Precision

### The Problem

Prior to the fix, the marshall was comparing milliseconds (from `Date.now() - Date.parse()`) directly against day values in **both** the new package detection and unmaintained package detection, leading to incorrect age calculations:

```javascript
// BUGGY CODE (before fix)
const dateDiff = Date.now() - Date.parse(pkgCreatedDate)
if (dateDiff < PACKAGE_AGE_THRESHOLD) { // Comparing ms to days!
    throw new Error(...)
}

// Also buggy for unmaintained packages
const versionDateDiff = new Date() - new Date(versionReleaseDate)
const versionDateDiffInDays = Math.round(versionDateDiff / (1000 * 60 * 60 * 24))
if (versionDateDiffInDays >= PACKAGE_AGE_UNMAINTAINED_RISK) { // Inconsistent calculation!
    throw new Warning(...)
}
```

### The Fix

The fix ensures proper unit conversion by calculating both thresholds in milliseconds:

```javascript
// FIXED CODE (after fix)
const dateDiff = Date.now() - Date.parse(pkgCreatedDate)
const thresholdMs = PACKAGE_AGE_THRESHOLD * 24 * 60 * 60 * 1000
if (dateDiff < thresholdMs) { // Now comparing ms to ms
    throw new Error(...)
}

// Also fixed for unmaintained packages
const versionDateDiff = Date.now() - Date.parse(versionReleaseDate)
const unmaintainedThresholdMs = PACKAGE_AGE_UNMAINTAINED_RISK * 24 * 60 * 60 * 1000
if (versionDateDiff >= unmaintainedThresholdMs) { // Now consistent ms to ms
    throw new Warning(...)
}
```

### Impact

- **Before**: Packages newer than 22 milliseconds were flagged (essentially all packages)
- **After**: Packages newer than 22 days are correctly flagged
- **Before**: Unmaintained package detection had potential precision issues
- **After**: Both new and unmaintained package detection use consistent millisecond precision

## Validation Logic

### New Package Detection

```javascript
const pkgCreatedDate = data.time.created
const dateDiff = Date.now() - Date.parse(pkgCreatedDate)
const thresholdMs = PACKAGE_AGE_THRESHOLD * 24 * 60 * 60 * 1000

if (dateDiff < thresholdMs) {
    throw new Error(`Detected a newly published package (created < ${PACKAGE_AGE_THRESHOLD} days) act carefully`)
}
```

**Purpose**: New packages haven't had sufficient community review and may contain malicious code or be typosquatting attempts.

### Abandoned Package Detection

```javascript
const versionDateDiff = Date.now() - Date.parse(versionReleaseDate)
const versionDateDiffInDays = Math.round(versionDateDiff / (1000 * 60 * 60 * 24))
const unmaintainedThresholdMs = PACKAGE_AGE_UNMAINTAINED_RISK * 24 * 60 * 60 * 1000

if (versionDateDiff >= unmaintainedThresholdMs) {
    throw new Warning(`Detected an old package (created ${timeAgoNumber} ${timeAgoText} ago)`)
}
```

**Purpose**: Old packages may have unpatched security vulnerabilities or be abandoned by maintainers.

**Note**: Both millisecond precision comparison (`versionDateDiff >= unmaintainedThresholdMs`) and day-based display formatting (`versionDateDiffInDays`) are used to ensure accuracy while maintaining human-readable output.

## Error Handling

The marshall handles several edge cases:

1. **Missing Package Data**: Returns warning when registry data is unavailable
2. **Missing Time Information**: Returns warning when `time.created` or version timestamps are missing
3. **Future Dates**: Treats packages with future creation dates as new packages (handles clock skew)
4. **Invalid Dates**: Gracefully handles malformed date strings

## Acceptance Test Criteria

### Core Functionality Tests

#### ✅ New Package Detection
- **AC1**: Packages created less than 22 days ago MUST trigger an error
- **AC2**: Packages created exactly 22 days ago MUST NOT trigger an error
- **AC3**: Packages created more than 22 days ago MUST NOT trigger an error

#### ✅ Threshold Boundary Testing  
- **AC4**: Packages created just within the threshold (22 days - 1 second) MUST trigger an error
- **AC5**: Packages created exactly at 22-day boundary MUST NOT trigger an error
- **AC6**: Date calculations MUST use millisecond precision to prevent off-by-one errors
- **AC7**: Boundary tests MUST use deterministic timing (mocked Date.now) to prevent CI flakiness

#### ✅ Abandoned Package Detection
- **AC7**: Packages with versions older than 365 days MUST trigger a warning
- **AC8**: Warning message MUST include human-readable time format (days/years)
- **AC9**: Packages with versions newer than 365 days MUST NOT trigger warnings

#### ✅ Error Handling
- **AC10**: Missing `time.created` field MUST return "Could not determine package age" warning
- **AC11**: Completely missing package data MUST return "Could not determine package age" warning
- **AC12**: Missing version timestamp MUST return "Could not determine package version release date" warning

#### ✅ Edge Cases
- **AC13**: Packages with future creation dates MUST be treated as new packages
- **AC14**: Marshall MUST handle clock skew scenarios gracefully
- **AC15**: Date calculations MUST be resilient to timezone differences

### Regression Prevention Tests

#### ✅ Critical Bug Prevention
- **AC16**: Date threshold comparisons MUST convert days to milliseconds before comparison
- **AC17**: Test suite MUST include boundary condition tests at exactly 22 days
- **AC18**: Test suite MUST verify millisecond precision in calculations
- **AC19**: Package age of 21.5 days MUST trigger error (validates ms precision)
- **AC20**: Unmaintained package detection MUST use millisecond precision (validates consistency)

### Performance & Reliability

#### ✅ Data Validation
- **AC21**: Registry API failures MUST be handled gracefully with appropriate warnings
- **AC22**: Malformed date strings MUST NOT cause crashes
- **AC23**: Version resolution failures MUST return warnings, not errors

## Usage Examples

### Successful Validation (Old Package)
```javascript
const marshall = new Marshall({ packageRepoUtils })
await marshall.validate({ 
    packageName: 'express', 
    packageVersion: '4.18.0' 
})
// Returns: undefined (no errors/warnings)
```

### New Package Detection
```javascript
const marshall = new Marshall({ packageRepoUtils })
await marshall.validate({ 
    packageName: 'suspicious-new-package', 
    packageVersion: '1.0.0' 
})
// Throws: Error('Detected a newly published package (created < 22 days) act carefully')
```

### Abandoned Package Warning
```javascript
const marshall = new Marshall({ packageRepoUtils })
await marshall.validate({ 
    packageName: 'old-unmaintained-package', 
    packageVersion: '1.0.0' 
})
// Throws: Warning('Detected an old package (created 2 years ago)')
```

## Configuration

### Thresholds

- `PACKAGE_AGE_THRESHOLD`: 22 days (configurable via constant)
- `PACKAGE_AGE_UNMAINTAINED_RISK`: 365 days (configurable via constant)

### Dependencies

- `BaseMarshall`: Parent class providing common functionality
- `Warning`: Helper class for non-blocking warnings  
- `packageRepoUtils`: Registry interaction utilities

## Testing Strategy

The test suite covers:

1. **Boundary Testing**: Exact threshold values and edge cases
2. **Precision Testing**: Millisecond-level accuracy validation
3. **Error Scenarios**: Missing data and malformed responses
4. **Edge Cases**: Future dates, clock skew, timezone handling
5. **Integration Testing**: End-to-end validation with mock registry data

### Test Coverage: 96.87%

The comprehensive test suite ensures robust behavior across all scenarios and prevents regression of the critical date calculation bug.

### CI Test Reliability

**Issue**: Initial boundary tests failed intermittently in CI due to microsecond-level timing differences between test execution and marshall validation.

**Solution**: Implemented deterministic testing using:
1. **Mocked Date.now()** for precise boundary tests
2. **Larger time margins** (1 second vs 1 millisecond) to avoid race conditions  
3. **Fixed reference times** to eliminate timing variability

This ensures tests are reliable across different CI environments and execution speeds.

## Security Implications

### Risk Mitigation

1. **Supply Chain Attacks**: New packages are flagged for manual review
2. **Typosquatting**: Recently created packages with suspicious names are caught
3. **Abandoned Packages**: Old packages are flagged as potentially unmaintained

### Limitations

1. **False Positives**: Legitimate new packages may be flagged
2. **Bypass Potential**: Attackers could wait 22 days before publishing malicious updates
3. **Maintenance Assumption**: Age doesn't guarantee security or active maintenance

## Future Enhancements

1. **Configurable Thresholds**: Allow runtime configuration of age limits
2. **Graduated Warnings**: Different warning levels based on age ranges
3. **Maintenance Indicators**: Integration with repository activity metrics
4. **Community Signals**: Incorporation of download counts and community feedback
