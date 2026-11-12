# SkillGuard v0.3.0

**Release date:** 2026-11-12  
**Type:** Professional maturity & process release

## Highlights

SkillGuard 0.3.0 hardens project governance, documentation, and operational readiness. Detection rule behavior is unchanged; rule IDs SG001–SG017 remain stable.

### Governance
- Contributor Covenant Code of Conduct
- Expanded Security Policy with supported versions and coordinated disclosure
- SUPPORT guide
- Structured PR, bug, and feature request templates
- Professional CONTRIBUTING standards (offline / never-execute constraints)

### Documentation
- Production-grade README with core guarantees and precise limitations
- Refined Threat Model, Architecture, Rules, Roadmap, Competitive Landscape
- GitHub Action production hardening notes (SHA pinning, minimal permissions)
- Release and Trusted Publishing checklist

### Engineering hygiene
- CI concurrency and clearer step naming
- Package metadata and published file list improved
- Version consistency across `package.json`, `CITATION.cff`, README, SECURITY, CHANGELOG

### Author
**Khayom Abdurahmonov**  
https://github.com/Khayom1 · https://khayom1.github.io/ · https://veyrost.is-a.dev/

## Install

```bash
git clone https://github.com/Khayom1/SkillGuard.git
cd SkillGuard
npm install -g .
skillguard --version   # 0.3.0
```

## Verify

```bash
npm run verify
```

## Full changelog

See [CHANGELOG.md](CHANGELOG.md).
