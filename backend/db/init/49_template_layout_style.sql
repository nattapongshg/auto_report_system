-- Split template 'share_basis' into two fields:
--   share_basis   ∈ {gp, revenue}     → how location_share is calculated
--   layout_style  ∈ {standard, dealer} → which column grid to render
-- Previously, 'dealer' was a third share_basis value that conflated the two.
-- Migrate 'dealer' → share_basis='revenue', layout_style='dealer'.

ALTER TABLE report_layout_templates
    ADD COLUMN IF NOT EXISTS layout_style TEXT NOT NULL DEFAULT 'standard';

UPDATE report_layout_templates
   SET layout_style = 'dealer',
       share_basis = 'revenue'
 WHERE share_basis = 'dealer';
