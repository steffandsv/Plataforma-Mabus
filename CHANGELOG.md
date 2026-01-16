# Plataforma MABUS - Changelog

## [Version 2.1.0] - 2026-01-16

### Added - Feed & Buscador Transformation
- **NEW MODULE**: Buscador (Advanced Search) with multi-select filters
  - Tag-based keywords input
  - Multiple modalities, states, and spheres selection
  - Custom grid view without match badges or preview overlay
  - Results sorted by closing date
  
- **Feed Module Refactoring**
  - Renamed from "Licitações" to "Feed"
  - Story-mode only (removed grid view toggle)
  - Enhanced navigation with RSS icon
  
### Added - Bid Detail Page Refinements
- **Interest Controls**
  - Favorite button (heart icon) with save/unsave functionality
  - Dislike button (thumbs down) to mark bids as "no interest"
  - Backend: `user_disliked_licitacoes` table + API routes
  
- **Data Formatting**
  - CNPJ displayed in proper Brazilian format (XX.XXX.XXX/XXXX-XX)
  - Poder codes converted to full names (Executivo/Legislativo/Judiciário)
  - Esfera codes converted to full names (Municipal/Estadual/Federal)
  
- **Card Reorganization**
  - Removed "Publicação PNCP" and "Abertura Propostas" cards
  - Added unified "Envio da Proposta" card with opening and deadline dates
  - Moved "Detalhes Contratuais" next to "Órgão Contratante"
  
- **Interactive Map Integration**
  - Leaflet.js + OpenStreetMap integration
  - Automatic geocoding of bid addresses
  - Interactive radius control (1-50 km)
  - Placeholder for competitive search functionality
  - Full-width location card with map visualization

### Changed
- Navigation updated: "BUSCA" → "BUSCADOR", "LICITAÇÕES" → "FEED"
- Sidebar icons updated (RSS icon for Feed)

### Technical
- New database table: `user_disliked_licitacoes`
- New API endpoints: POST/DELETE `/api/licitacoes/:id/dislike`
- New database function: `searchLicitacoes` with multi-filter support
- New route: GET `/buscador` with pagination
- EJS helper functions for data formatting

---

##[Previous Versions]
See git history for previous changelog entries.
