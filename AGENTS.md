# Workspace Instructions

## UI Default

- Use `shadcn/ui` design language as the default for all new UI work unless the user explicitly requests another style.
- Prefer the visual direction from `https://ui.shadcn.com/`: clean white surfaces, subtle borders, restrained shadows, neutral backgrounds, and simple spacing.
- Default to low-chrome product UI. Avoid decorative gradients, glassmorphism, heavy shadows, and custom visual experiments unless requested.
- Prefer reusable primitives and consistent composition over one-off styling.

## Component Patterns

- For React projects, prefer the typical `shadcn/ui` structure:
  - `components/ui/*`
  - `lib/utils.ts`
  - shared tokens in `globals.css`, `index.css`, or equivalent
- Prefer standard shadcn-style components for:
  - buttons
  - inputs
  - selects
  - dialogs
  - dropdown menus
  - sheets
  - tables
  - tabs
  - badges
  - cards
- Keep component APIs simple and composable.

## Visual Rules

- Use neutral surfaces first, accent color second.
- Prefer rounded corners in the small-to-medium range, not oversized.
- Use borders to define layout before adding shadows.
- Keep typography clear and compact.
- Prefer simple page structure: header, controls, content area, secondary panel if needed.
- Default tables, forms, and filters should look like `shadcn/ui`, not custom dashboard kits.

## Behavior

- When creating a new UI from scratch, start from shadcn-style layout and components by default.
- If the existing repo already has a stronger local design system, preserve that system instead of forcing shadcn styling.
- If the user says "use shadcn" or references `ui.shadcn.com`, treat that as the primary design instruction for the task.

## Scope

- These rules apply to this workspace by default.
- A deeper `AGENTS.md` inside a subproject may override these rules for that subproject.
