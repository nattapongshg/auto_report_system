-- Strip NBSP (U+00A0) and trim trailing/leading whitespace from locations.name
-- so CSV matching works without surprises.
UPDATE locations
   SET name = trim(replace(name, chr(160), ' '))
 WHERE name <> trim(replace(name, chr(160), ' '));
