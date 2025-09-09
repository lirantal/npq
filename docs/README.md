# NPQ Documentation

This directory contains comprehensive documentation for the NPQ (Node Package Quality) security auditing tool.

## Core Documentation

### `optional-features.md`
Configuration and usage of optional security features, including recent improvements and bug fixes.

### `age.marshall.md`  
Detailed documentation of the Age Marshall security component that validates package age and maturity.

## Feature Documentation

The `feature/` directory contains detailed documentation for specific features and implementations:

### Recent Developments

- **`test-coverage-improvements.md`** - Comprehensive test coverage enhancements that improved overall coverage from 84.4% to 93.39%
- **`signature-verification-fix.md`** - Critical bug fix for signature verification with version ranges (e.g., `@angular/common@^20.2.4`)

### Existing Features  

- **`auto-continue.md`** - Documentation for the auto-continue feature that streamlines package installation workflows
- **`pacote-dependency-reduction.md`** - Implementation summary for optional pacote dependency reduction

## Documentation Standards

### Structure
- Each feature gets its own markdown file in `feature/`
- Core functionality documented at the root docs level  
- Technical implementation details included with code examples
- User-facing configuration documented with usage examples

### Content Guidelines
- **Overview**: Brief description of the feature/component
- **Technical Design**: Architecture and implementation details
- **Usage Examples**: Practical examples with code snippets
- **Testing**: Coverage and validation information
- **Future Considerations**: Maintenance and evolution notes

## Marshall Documentation

Marshall components are the core security validation modules in NPQ. Each marshall focuses on a specific security concern:

- **Age Marshall** (`age.marshall.md`) - Package age and maturity validation
- **Signature Marshall** - NPM registry signature verification (see `signature-verification-fix.md`)
- **Provenance Marshall** - Package build attestation verification
- **Snyk Marshall** - Vulnerability database integration
- **Typosquatting Marshall** - Package name similarity detection

## Contributing to Documentation

When adding new features or making significant changes:

1. **Feature Documentation**: Create a new file in `feature/` directory
2. **Update Index**: Add entry to this README
3. **Cross-Reference**: Update related documentation files
4. **Examples**: Include practical usage examples
5. **Testing**: Document test coverage and validation

## Quick Reference

| Topic | File | Purpose |
|-------|------|---------|
| Optional Features | `optional-features.md` | Feature configuration and recent improvements |
| Age Validation | `age.marshall.md` | Package age and maturity security checks |
| Test Coverage | `feature/test-coverage-improvements.md` | Recent test suite enhancements |
| Signature Verification | `feature/signature-verification-fix.md` | Version range bug fix and validation |
| Auto-Continue | `feature/auto-continue.md` | Automated installation workflow |
| Dependency Reduction | `feature/pacote-dependency-reduction.md` | Optional dependency management |
