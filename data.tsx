import React from 'react';
import { 
  Box, 
  Grid3X3, 
  Eye, 
  Cpu, 
  Type, 
  Files, 
  Ruler, 
  Network, 
  Code, 
  Puzzle 
} from 'lucide-react';
import { Section, CanvasElement } from './types';
import { MarkdownHeader, CodeBlock, Paragraph } from './components/ui';

export const SECTIONS: Section[] = [
  {
    id: 'core',
    title: '1. Core Data Structures',
    icon: <Box size={18} />,
    content: (
      <div>
        <MarkdownHeader>Canvas Model</MarkdownHeader>
        <Paragraph>
          The Canvas represents the physical or digital substrate for layout. It defines the fundamental coordinate space, dimensions, and output constraints like DPI and color space.
        </Paragraph>
        <CodeBlock title="python">
{`class Canvas:
    id: UUID
    dimensions: Dimensions  # width, height in points (1/72 inch)
    coordinate_system: CoordinateSystem
    dpi: float  # typically 300 for print, 72 for screen
    bleed: Margins  # print bleed zones
    safe_zones: List[Rectangle]  # areas to avoid (binding margins, etc.)
    grid: Grid  # underlying grid system
    color_space: ColorSpace  # RGB, CMYK, etc.`}
        </CodeBlock>
        
        <MarkdownHeader>Page & Elements</MarkdownHeader>
        <Paragraph>
          Pages act as containers for Elements, maintaining z-order and managing constraints. Elements are the building blocks, using strict Bounding Box geometry.
        </Paragraph>
        <CodeBlock title="python">
{`class Page:
    id: UUID
    canvas: Canvas
    elements: OrderedDict[UUID, Element]  # z-order preserved
    layout_strategy: LayoutStrategy
    constraints: List[Constraint]
    metadata: PageMetadata

class Element:
    id: UUID
    type: ElementType
    bounds: BoundingBox  # AABB (Axis-Aligned Bounding Box)
    transform: Transform  # position, rotation, scale, skew
    geometry: Geometry  # precise shape (rect, polygon, bezier)
    z_index: int
    constraints: List[Constraint]

class BoundingBox:
    x: float; y: float
    width: float; height: float
    rotation: float
    
    def intersects(self, other: BoundingBox) -> bool:
        """Check for intersection using SAT (Separating Axis Theorem)"""`}
        </CodeBlock>
      </div>
    )
  },
  {
    id: 'math',
    title: '2. Mathematical Foundations',
    icon: <Grid3X3 size={18} />,
    content: (
      <div>
        <MarkdownHeader>Coordinate Transformations</MarkdownHeader>
        <Paragraph>
          We employ affine transformation matrices for all spatial operations. This ensures that scaling, rotation, and translation can be composed into single operations for performance and precision.
        </Paragraph>
        <CodeBlock title="python">
{`class Transform:
    """Affine transformation matrix"""
    matrix: Matrix3x3  # [a b tx]
                       # [c d ty]
                       # [0 0  1]
    
    def compose(self, other: Transform) -> Transform:
        """Multiply matrices for combined transformations"""
        return Transform(self.matrix @ other.matrix)
    
    def apply(self, point: Point) -> Point:
        """Transform a point using homogeneous coordinates"""
        p_homogeneous = [point.x, point.y, 1]
        result = self.matrix @ p_homogeneous
        return Point(result[0], result[1])`}
        </CodeBlock>

        <MarkdownHeader>Constraint System</MarkdownHeader>
        <Paragraph>
          The engine relies on a solver-based constraint system to enforce alignment, distribution, and design rules dynamically.
        </Paragraph>
        <CodeBlock title="python">
{`class AlignmentConstraint(Constraint):
    elements: List[UUID]
    axis: Enum[LEFT, RIGHT, TOP, BOTTOM, CENTER_X, CENTER_Y]
    
    def evaluate(self, layout: Layout) -> float:
        """Returns constraint violation score"""
        positions = [layout.get_element(e).bounds for e in self.elements]
        target_values = [getattr(p, self.axis.value) for p in positions]
        return variance(target_values)  # 0 = perfect alignment

class Grid:
    """Mathematical grid for alignment"""
    type: Enum[MODULAR, BASELINE, COLUMNAR]
    
    def snap_to_grid(self, point: Point, tolerance: float) -> Point:
        """Snap coordinates to nearest grid intersection"""`}
        </CodeBlock>
      </div>
    )
  },
  {
    id: 'analysis',
    title: '3. Image Analysis',
    icon: <Eye size={18} />,
    content: (
      <div>
        <MarkdownHeader>Content Intelligence</MarkdownHeader>
        <Paragraph>
          Before placement, images are analyzed to extract semantic and structural data. This prevents bad crops and ensures text isn't placed over busy areas.
        </Paragraph>
        <CodeBlock title="python">
{`class ImageAnalyzer:
    def analyze(self, image: Image) -> ImageAnalysis:
        return ImageAnalysis(
            focal_points=self.detect_focal_points(image),
            content_density=self.compute_density_map(image),
            dominant_colors=self.extract_color_palette(image),
            saliency_map=self.compute_saliency(image),
            text_regions=self.detect_text_regions(image)
        )
    
    def detect_focal_points(self, image: Image) -> List[Point]:
        """Uses saliency + face detection + rule of thirds"""
        # 1. Neural saliency model (e.g., MSI-Net)
        # 2. Face detection priority
        # 3. Intersection of thirds lines`}
        </CodeBlock>
      </div>
    )
  },
  {
    id: 'planning',
    title: '4. Layout Planning',
    icon: <Cpu size={18} />,
    content: (
      <div>
        <MarkdownHeader>AI Layout Planner</MarkdownHeader>
        <Paragraph>
           The core brain of the engine. It generates candidates, scores them against design principles (balance, hierarchy, readability), and refines the best option.
        </Paragraph>
        <CodeBlock title="python">
{`class LayoutPlanner:
    def plan_layout(self, page, content, style) -> LayoutPlan:
        # Phase 1: Analyze content
        content_analysis = self.analyze_content(content)
        
        # Phase 2: Generate candidates (Rule-based + ML)
        candidates = self.generate_candidates(page, content_analysis, style)
        
        # Phase 3: Score and rank
        scored = [(self.score_layout(c), c) for c in candidates]
        
        # Phase 4: Refine top candidate
        return self.refine_layout(scored[0][1])

    def score_layout(self, layout: Layout) -> float:
        """Multi-objective scoring function"""
        return sum([
            0.15 * self.score_alignment(layout),
            0.20 * self.score_visual_balance(layout),
            0.20 * self.score_readability(layout),
            0.15 * self.score_hierarchy(layout),
            0.05 * self.score_constraints(layout)
        ])`}
        </CodeBlock>
        
        <MarkdownHeader>Spatial Optimizer</MarkdownHeader>
        <CodeBlock title="python">
{`class SpatialOptimizer:
    def optimize(self, elements, constraints, canvas) -> Layout:
        """
        minimize: E(layout) = w1*E_align + w2*E_overlap + ...
        subject to: hard_constraints
        """
        # Initial placement using heuristics
        initial = self.greedy_placement(elements, canvas)
        
        # Refine using SQP (Sequential Quadratic Programming)
        # or Genetic Algorithm
        return self.sqp_optimize(initial, constraints)`}
        </CodeBlock>
      </div>
    )
  },
  {
    id: 'elements',
    title: '5. Element Management',
    icon: <Type size={18} />,
    content: (
      <div>
        <MarkdownHeader>Text Flow Engine</MarkdownHeader>
        <Paragraph>
          Handles advanced typography features like hyphenation, justification, and wrapping text around irregular obstacles.
        </Paragraph>
        <CodeBlock title="python">
{`class TextFlowEngine:
    def flow_text(self, text, container, typography) -> TextLayout:
        """
        Performs text layout with:
        - Line breaking (Knuth-Plass algorithm)
        - Hyphenation & Justification
        - Baseline grid alignment
        """
        tokens = self.tokenize(text)
        breakpoints = self.knuth_plass_algorithm(tokens, container.width)
        runs = self.create_text_runs(tokens, breakpoints)
        return TextLayout(runs=runs)
    
    def compute_text_wrap(self, text_el, obstacles) -> List[Rectangle]:
        """Compute text flow around images/obstacles"""
        exclusions = [obs.geometry for obs in obstacles]
        return self.decompose_with_exclusions(text_el.bounds, exclusions)`}
        </CodeBlock>
        
        <MarkdownHeader>Shape Operations</MarkdownHeader>
        <CodeBlock title="python">
{`class ShapeEngine:
    """Computational geometry operations"""
    def boolean_subtract(self, base: Polygon, sub: Polygon) -> List[Polygon]:
        """Subtract one shape from another (e.g. text wrap)"""
        
    def simplify(self, shape: Polygon, tolerance: float) -> Polygon:
        """Reduce vertices using Douglas-Peucker"""`}
        </CodeBlock>
      </div>
    )
  },
  {
    id: 'multipage',
    title: '6. Multi-Page Management',
    icon: <Files size={18} />,
    content: (
      <div>
        <MarkdownHeader>Document Structure</MarkdownHeader>
        <Paragraph>
          Manages the relationships between pages, spreads, and master templates. Handles consistent styling across long-form documents.
        </Paragraph>
        <CodeBlock title="python">
{`class Document:
    pages: List[Page]
    master_pages: Dict[str, MasterPage]
    spreads: List[Spread]  # for facing pages
    
class Spread:
    """Two-page spread (left + right facing pages)"""
    left_page: Page
    right_page: Page
    gutter: float
    
    def optimize_spread_layout(self):
        """Optimize layout considering both pages"""
        # Balance visual weight across spread
        # Align elements across gutter`}
        </CodeBlock>
      </div>
    )
  },
  {
    id: 'precision',
    title: '7. Precision & Consistency',
    icon: <Ruler size={18} />,
    content: (
      <div>
        <MarkdownHeader>Measurement System</MarkdownHeader>
        <Paragraph>
          Ensures output is production-ready by handling unit conversions and sub-pixel snapping for screen rendering.
        </Paragraph>
        <CodeBlock title="python">
{`class UnitConverter:
    POINTS_PER_INCH = 72.0
    
    def points_to_mm(self, points: float) -> float:
        return (points / 72.0) * 25.4

class PrecisionEngine:
    tolerance: float = 0.01
    
    def snap_to_pixel_grid(self, point: Point, ppi: float) -> Point:
        """Snap to actual device pixels for crisp rendering"""
        px = 72.0 / ppi
        return Point(
            round(point.x / px) * px,
            round(point.y / px) * px
        )`}
        </CodeBlock>
        
        <MarkdownHeader>Consistency Enforcement</MarkdownHeader>
        <CodeBlock title="python">
{`class ConsistencyEngine:
    def detect_inconsistencies(self, document) -> List[Issue]:
        """Find layout inconsistencies"""
        # Check margin variance across pages
        # Check typography consistency against style guide
        # Verify baseline rhythm`}
        </CodeBlock>
      </div>
    )
  },
  {
    id: 'ai',
    title: '8. AI Planning Architecture',
    icon: <Network size={18} />,
    content: (
      <div>
        <MarkdownHeader>AILayoutEngine</MarkdownHeader>
        <Paragraph>
          The high-level orchestrator that combines analysis, planning, and optimization into a single pipeline.
        </Paragraph>
        <CodeBlock title="python">
{`class AILayoutEngine:
    def __init__(self):
        self.analyzer = ImageAnalyzer()
        self.planner = LayoutPlanner()
        self.optimizer = SpatialOptimizer()
        
    def generate_layout(self, content, canvas, style, constraints) -> Layout:
        # 1. Analyze images (focal points, composition)
        analyzed = [self.analyzer.analyze(c) if is_img(c) else c for c in content]
        
        # 2. Plan initial layout
        plan = self.planner.plan_layout(Page(canvas), analyzed, style)
        
        # 3. Solve constraints
        constrained = self.constraint_solver.solve(plan, constraints)
        
        # 4. Refine typography
        final = self.refine_typography(constrained)
        
        return final`}
        </CodeBlock>
      </div>
    )
  },
  {
    id: 'workflow',
    title: '9. Example Workflow',
    icon: <Code size={18} />,
    content: (
      <div>
        <MarkdownHeader>Python Implementation</MarkdownHeader>
        <Paragraph>
          A programmatic example of defining a canvas, adding content, setting constraints, and generating a layout.
        </Paragraph>
        <CodeBlock title="python">
{`# 1. Define Canvas
canvas = Canvas(
    dimensions=Dimensions(width=432, height=648), # 6x9"
    grid=Grid(columns=12, gutter=18)
)

# 2. Define Content
content = [
    ImageBlock("skeleton.jpg", priority=HIGH),
    TextBlock("The human skeleton...", style=BODY)
]

# 3. Add Constraints
constraints = [
    MarginConstraint(top=26, right=26, bottom=26, left=36),
    AlignmentConstraint(["heading", "body"], axis=LEFT),
    AspectRatioConstraint("image", ratio=1.5)
]

# 4. Generate
engine = AILayoutEngine()
layout = engine.generate_layout(content, canvas, constraints)

# 5. Render
renderer.render(layout)`}
        </CodeBlock>
      </div>
    )
  },
  {
    id: 'extensibility',
    title: '10. Extensibility',
    icon: <Puzzle size={18} />,
    content: (
      <div>
        <MarkdownHeader>System Extensions</MarkdownHeader>
        <Paragraph>
          The architecture supports a plugin-based model to allow for domain-specific adaptations.
        </Paragraph>
        <ul className="list-disc pl-6 space-y-2 text-slate-300 font-light mt-4">
          <li><strong>Plugin Architecture</strong>: Custom analyzers, generators, scorers</li>
          <li><strong>Template Library</strong>: Expandable layout templates (JSON/YAML)</li>
          <li><strong>Rule Engine</strong>: User-defined layout rules</li>
          <li><strong>ML Model Integration</strong>: Train custom models on domain-specific layouts</li>
          <li><strong>Format Adapters</strong>: Export to PDF, InDesign (IDML), Figma, or HTML/CSS</li>
        </ul>
      </div>
    )
  }
];

export const INITIAL_ELEMENTS: CanvasElement[] = [
  { 
    id: '1', 
    type: 'image', 
    x: 40, 
    y: 40, 
    w: 515, 
    h: 200, 
    color: 'bg-emerald-500/20', 
    zIndex: 1, 
    name: 'Hero Image',
    src: 'https://images.unsplash.com/photo-1620641788421-7f1c338e420c?q=80&w=2070&auto=format&fit=crop'
  },
  { 
    id: '2', 
    type: 'text', 
    x: 40, 
    y: 260, 
    w: 515, 
    h: 50, 
    color: 'bg-transparent', 
    zIndex: 2, 
    name: 'Headline',
    content: 'AI Layout Engine Architect',
    textStyle: { fontSize: 32, fontWeight: 'bold', color: '#ec5b13', textAlign: 'left', lineHeight: 1.2 }
  },
  { 
    id: 'subhead-1', 
    type: 'text', 
    x: 40, 
    y: 310, 
    w: 300, 
    h: 30, 
    color: 'bg-transparent', 
    zIndex: 2, 
    name: 'Subheading',
    content: 'Intelligent design automation for the modern web.',
    textStyle: { fontSize: 16, fontWeight: '500', color: '#64748b', textAlign: 'left' }
  },
  { 
    id: '3', 
    type: 'text', 
    x: 40, 
    y: 360, 
    w: 240, 
    h: 120, 
    color: 'bg-slate-500/10', 
    zIndex: 2, 
    name: 'Body Copy',
    content: 'Generate stunning designs with AI-powered precision. Our engine adapts content to any viewport while maintaining strict visual hierarchy and typographic rhythm.',
    textStyle: { fontSize: 14, lineHeight: 1.5, color: '#94a3b8', textAlign: 'left' }
  },
  {
    id: 'feat-img-1',
    type: 'image',
    x: 300,
    y: 360,
    w: 255,
    h: 150,
    color: 'bg-indigo-500/20',
    zIndex: 2,
    name: 'Feature Image',
    src: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1974&auto=format&fit=crop'
  }
];