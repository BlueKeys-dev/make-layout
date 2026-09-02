# Repository Map

Last updated: 2026-09-02

## Contributor documentation

- `AGENTS.md` describes the repository structure, local commands, coding style, testing approach, and contribution expectations.

## Application entry and state

- `index.tsx` mounts the React application.
- `App.tsx` loads the editor shell.
- `components/DesignEditor.tsx` owns pages, current-page elements, selection, active board, history, canvas configuration, layout-library actions, and the WebMCP bridge.
- `DesignEditor` initializes the world translation at negative half the primary board dimensions so the main board opens centered without forcing later recentering.
- `hooks/useHistory.ts` stores undo/redo snapshots for the page array.
- `hooks/useCanvasInteraction.ts` owns selection, dragging, and resize interactions.

## Canvas and boards

- `components/canvas/CanvasStage.tsx` renders the primary board at world origin `(0, 0)` and every canvas element as an absolute sibling.
- `components/CanvasElementRender.tsx` routes each `CanvasElement.type` to its renderer.
- Secondary boards are `CanvasElement` containers. Their children are associated geometrically and use absolute world coordinates inside the board bounds; there is no parent-child element tree.
- `components/CanvasSettingsBar.tsx` edits the active board or primary canvas and opens the layout library.
- `components/PropertiesPanel.tsx` edits selected elements, including layout-slot roles.

## Reusable layouts

- `services/layoutTemplates.ts` owns the versioned template schema, eight built-in templates, validation, normalized geometry, local persistence, target-relative instantiation, and slot-role conversion.
- `components/LayoutLibrary.tsx` renders template previews and triggers load/save/delete callbacks.
- UI loading flows through `DesignEditor.handleLoadLayoutTemplate`; it resolves the selected board, instantiates absolute slot coordinates for that board, and appends slots without removing existing elements.
- User-template saving uses the selected board bounds and includes only marked slots fully inside that board.

## Agent tools

- `services/canvasToolCatalog.ts` is the single WebMCP/chat tool schema catalog.
- `services/canvasToolEngine.ts` validates and executes tool requests. `load_layout_template` resolves `activeBoardId` and returns `layoutElementsToAdd`.
- `services/webmcp.ts` registers catalog tools and serializes mutations.
- `components/DesignEditor.tsx` applies tool effects to live editor state and enforces revision/UI-lock checks.

## Rich content and safety

- `components/MindMapElement.tsx` converts mind-map data or Mermaid source into rendered SVG and applies a fallback when rendering fails.
- `utils/contentSecurity.ts` sanitizes rich text, Mermaid source, and Mermaid SVG. Mermaid HTML entities must be normalized before strict XML parsing.
- `components/TableElement.tsx`, `components/TextElement.tsx`, and `components/MathElement.tsx` render their corresponding element content.

## Persistence and export

- Editor pages persist in browser local storage from `components/DesignEditor.tsx`.
- User layout templates persist separately through `services/layoutTemplates.ts`.
- `utils/exportUtils.ts` exports PNG, PDF, PPTX, and project JSON; unassigned layout-slot guides are removed from visual exports.

## Change-routing rule

- Board/layout behavior: start with `components/DesignEditor.tsx` and `services/layoutTemplates.ts`.
- Agent layout behavior: also inspect `services/canvasToolCatalog.ts`, `services/canvasToolEngine.ts`, and `services/webmcp.ts`.
- Element rendering failures: start with `components/CanvasElementRender.tsx`, then the type-specific renderer and `utils/contentSecurity.ts`.
