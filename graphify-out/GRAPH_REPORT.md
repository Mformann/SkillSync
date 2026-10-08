# Graph Report - AI Resume Analyzer UI Design  (2026-09-17)

## Corpus Check
- Corpus is ~40,694 words - fits in a single context window. You may not need a graph.

## Summary
- 914 nodes · 1621 edges · 112 communities (36 shown, 60 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend Authorization Boundaries
- Career Data Models
- Sidebar Layout Controls
- Shared Display Components
- Explainable AI Analysis
- Resume Dashboard Schemas
- Frontend Build Dependencies
- Dialog Pagination Controls
- Resume Version Management
- Dashboard Career Packages
- Status Display Widgets
- Command Palette Controls
- Application Route Pages
- TypeScript Compiler Configuration
- Frontend Authentication Navigation
- Documented Runtime Stack
- Frontend Dependency Manifest
- Menubar Interaction Controls
- Context Menu Controls
- Dropdown Menu Controls
- Career Interview Workspaces
- Carousel Interaction Controls
- Accessible Form Controls
- Chart Rendering Controls
- Drawer Overlay Controls
- Select Input Controls
- Navigation Menu Controls
- Requirement Match Presentation
- Learning Roadmap Presentation
- Resume Studio Presentation
- Design Assets Guidelines
- Toggle Interaction Controls
- Public Skill Gap Endpoint
- Alert Feedback Controls
- One Time Password Inputs
- Popover Overlay Controls
- Skill Gap Presentation
- Vercel Deployment Configuration
- Class Variance Library
- Command Palette Library
- Carousel Engine Library
- Emotion React Library
- Emotion Styling Library
- ESLint Core Library
- React Lint Library
- Framer Motion Library
- Canvas Capture Library
- HTML Image Library
- PDF Export Library
- Lucide Icon Library
- Motion Animation Library
- Material Icon Library
- Material Component Library
- Popper Positioning Library
- Radix Accordion Library
- Radix Alert Dialog
- Radix Aspect Ratio
- Radix Avatar Library
- Radix Checkbox Library
- Radix Collapsible Library
- Radix Context Menu
- Radix Dropdown Menu
- Radix Hover Card
- Radix Menubar Library
- Radix Navigation Menu
- Radix Popover Library
- Radix Progress Library
- Radix Radio Group
- Radix Scroll Area
- Radix Select Library
- Radix Separator Library
- Radix Slider Library
- Radix Slot Library
- Radix Tabs Library
- Radix Toggle Library
- Radix Toggle Group
- Radix Tooltip Library
- React Runtime Library
- React Calendar Library
- React Drag Drop
- HTML Drag Backend
- React DOM Library
- React Form Library
- React Popper Library
- Resizable Panel Library
- Responsive Masonry Library
- React Routing Library
- Slick Carousel Library
- Recharts Chart Library
- Sonner Notification Library
- Supabase Client Library
- Tailwind Merge Library
- Tailwind Animation Library
- TypeScript Lint Library
- TypeScript Parser Library
- Vaul Drawer Library

## God Nodes (most connected - your core abstractions)
1. `cn()` - 223 edges
2. `AuthenticatedUser` - 47 edges
3. `Base` - 17 edges
4. `compilerOptions` - 14 edges
5. `get_current_user()` - 13 edges
6. `upload_resume()` - 11 edges
7. `build_plan_tasks()` - 11 edges
8. `api` - 11 edges
9. `_plan_out()` - 9 edges
10. `run_explainable_analysis()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Supabase Authentication and Protected Routes` --semantically_similar_to--> `Backend JWT and bcrypt Authentication`  [INFERRED] [semantically similar]
  README.md → backend/README.md
- `AI Resume Analyzer HTML Shell` --conceptually_related_to--> `SkillSync Career-Readiness Workspace`  [INFERRED]
  frontend/index.html → README.md
- `Primary Secondary and Tertiary Button Hierarchy` --conceptually_related_to--> `shadcn/ui`  [INFERRED]
  guidelines/Guidelines.md → ATTRIBUTIONS.md
- `test_extract_skills_is_case_insensitive()` --calls--> `extract_skills()`  [EXTRACTED]
  backend/tests/test_phase_one.py → backend/app/services/analysis_service.py
- `AlertDialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  frontend/src/app/components/ui/alert-dialog.tsx → frontend/src/app/components/ui/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Evidence-Grounded Career Readiness Flow** — readme_explainable_matching, readme_learning_plans, readme_truth_grounded_materials [INFERRED 0.85]
- **SkillSync Full-Stack Runtime** — readme_skillsync, frontend_index_main_tsx, backend_requirements_fastapi, backend_requirements_sqlalchemy [INFERRED 0.95]

## Communities (112 total, 60 thin omitted)

### Community 0 - "Backend Authorization Boundaries"
Cohesion: 0.06
Nodes (77): AuthenticatedUser, get_current_user(), get_session(), TargetJob, get_me(), get, Return the identity verified from the Supabase access token., add_evidence() (+69 more)

### Community 1 - "Career Data Models"
Cohesion: 0.07
Nodes (47): as_declarative, Base, init_db(), create_app(), Analysis, ApplicationEvent, ApplicationPackage, CareerAchievement (+39 more)

### Community 2 - "Sidebar Layout Controls"
Cohesion: 0.05
Nodes (42): Input(), Separator(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+34 more)

### Community 3 - "Shared Display Components"
Cohesion: 0.08
Nodes (36): AccordionContent(), AccordionItem(), AccordionTrigger(), Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem() (+28 more)

### Community 4 - "Explainable AI Analysis"
Cohesion: 0.11
Nodes (34): ABC, post, run_explainable_analysis(), AIAnalysis, analysis_input_hash(), AnalysisProvider, calculate_scores(), GroqProvider (+26 more)

### Community 5 - "Resume Dashboard Schemas"
Cohesion: 0.14
Nodes (32): get_dashboard_summary(), get, Returns a summary based on the most recent analysis for the user, or a generic…, get_all_resumes(), get_analysis(), get_explainable_analysis(), get_gap_report(), get_latest_analysis() (+24 more)

### Community 6 - "Frontend Build Dependencies"
Cohesion: 0.07
Nodes (28): devDependencies, tailwindcss, @tailwindcss/vite, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name (+20 more)

### Community 7 - "Dialog Pagination Controls"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+10 more)

### Community 8 - "Resume Version Management"
Cohesion: 0.17
Nodes (22): ResumeVersion, create_version(), download_docx(), list_versions(), _out(), _owned(), BaseModel, get (+14 more)

### Community 9 - "Dashboard Career Packages"
Cohesion: 0.11
Nodes (13): ApplicationPackagePage, DashboardPage, PrivacyPage, UploadPage, labels, Package, Goal, GrowthSkill (+5 more)

### Community 10 - "Status Display Widgets"
Cohesion: 0.10
Nodes (10): Badge(), badgeVariants, Checkbox(), HoverCardContent(), Progress(), ResizableHandle(), ResizablePanelGroup(), Slider() (+2 more)

### Community 11 - "Command Palette Controls"
Cohesion: 0.12
Nodes (14): Command(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut(), Dialog() (+6 more)

### Community 12 - "Application Route Pages"
Cohesion: 0.13
Nodes (9): App(), CareerVaultPage, LandingPage, WorkspacesPage, Achievement, Vault, ThemeProvider(), Workspace (+1 more)

### Community 13 - "TypeScript Compiler Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, module, moduleResolution (+11 more)

### Community 14 - "Frontend Authentication Navigation"
Cohesion: 0.18
Nodes (10): LoginPage, SignupPage, AuthContext, AuthProvider(), AuthState, useAuth(), LoginPage(), Navigation() (+2 more)

### Community 15 - "Documented Runtime Stack"
Cohesion: 0.14
Nodes (18): Backend API Documentation, Backend JWT and bcrypt Authentication, Resume Analysis and Dashboard APIs, Backend Dependency Manifest, FastAPI and Uvicorn, python-jose 3.3.0, pypdf and python-docx, SQLAlchemy Alembic and psycopg (+10 more)

### Community 16 - "Frontend Dependency Manifest"
Cohesion: 0.12
Nodes (17): axios, clsx, date-fns, dependencies, axios, clsx, date-fns, input-otp (+9 more)

### Community 17 - "Menubar Interaction Controls"
Cohesion: 0.12
Nodes (11): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator(), MenubarShortcut() (+3 more)

### Community 18 - "Context Menu Controls"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 19 - "Dropdown Menu Controls"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 20 - "Career Interview Workspaces"
Cohesion: 0.14
Nodes (11): CareerHubPage, Analytics, Application, Detail, Evidence, Question, Readiness, Score (+3 more)

### Community 21 - "Carousel Interaction Controls"
Cohesion: 0.19
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 22 - "Accessible Form Controls"
Cohesion: 0.20
Nodes (11): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+3 more)

### Community 23 - "Chart Rendering Controls"
Cohesion: 0.25
Nodes (9): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload(), THEMES (+1 more)

### Community 24 - "Drawer Overlay Controls"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 25 - "Select Input Controls"
Cohesion: 0.18
Nodes (7): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 26 - "Navigation Menu Controls"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 27 - "Requirement Match Presentation"
Cohesion: 0.22
Nodes (6): AnalysisPage, ExplainableResponse, MatchStatus, Requirement, RequirementMatch, statusMeta

### Community 28 - "Learning Roadmap Presentation"
Cohesion: 0.25
Nodes (7): RoadmapPage, dateAfter(), Plan, PracticalTest, RoadmapPage(), Task, YouTubeResource

### Community 29 - "Resume Studio Presentation"
Cohesion: 0.25
Nodes (5): ResumeStudioPage, Content, Evidence, Version, Warning

### Community 30 - "Design Assets Guidelines"
Cohesion: 0.29
Nodes (7): MIT License, shadcn/ui, Third-Party Assets, Unsplash Photos and License, Primary Secondary and Tertiary Button Hierarchy, Responsive Modular Layout Guidance, AI Guidelines Template

### Community 31 - "Toggle Interaction Controls"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 32 - "Public Skill Gap Endpoint"
Cohesion: 0.50
Nodes (4): BaseModel, post, skill_gap_analysis(), SkillGapRequest

### Community 33 - "Alert Feedback Controls"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 34 - "One Time Password Inputs"
Cohesion: 0.40
Nodes (3): InputOTP(), InputOTPGroup(), InputOTPSlot()

### Community 38 - "Vercel Deployment Configuration"
Cohesion: 0.50
Nodes (3): buildCommand, framework, outputDirectory

## Knowledge Gaps
- **161 isolated node(s):** `name`, `private`, `version`, `type`, `build` (+156 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 292 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **60 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Shared Display Components` to `Alert Feedback Controls`, `Sidebar Layout Controls`, `One Time Password Inputs`, `Popover Overlay Controls`, `Dialog Pagination Controls`, `Status Display Widgets`, `Command Palette Controls`, `Menubar Interaction Controls`, `Context Menu Controls`, `Dropdown Menu Controls`, `Carousel Interaction Controls`, `Accessible Form Controls`, `Chart Rendering Controls`, `Drawer Overlay Controls`, `Select Input Controls`, `Navigation Menu Controls`, `Toggle Interaction Controls`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Frontend Dependency Manifest` to `Frontend Build Dependencies`, `Class Variance Library`, `Command Palette Library`, `Carousel Engine Library`, `Emotion React Library`, `Emotion Styling Library`, `ESLint Core Library`, `React Lint Library`, `Framer Motion Library`, `Canvas Capture Library`, `HTML Image Library`, `PDF Export Library`, `Lucide Icon Library`, `Motion Animation Library`, `Material Icon Library`, `Material Component Library`, `Popper Positioning Library`, `Radix Accordion Library`, `Radix Alert Dialog`, `Radix Aspect Ratio`, `Radix Avatar Library`, `Radix Checkbox Library`, `Radix Collapsible Library`, `Radix Context Menu`, `Radix Dropdown Menu`, `Radix Hover Card`, `Radix Menubar Library`, `Radix Navigation Menu`, `Radix Popover Library`, `Radix Progress Library`, `Radix Radio Group`, `Radix Scroll Area`, `Radix Select Library`, `Radix Separator Library`, `Radix Slider Library`, `Radix Slot Library`, `Radix Tabs Library`, `Radix Toggle Library`, `Radix Toggle Group`, `Radix Tooltip Library`, `React Runtime Library`, `React Calendar Library`, `React Drag Drop`, `HTML Drag Backend`, `React DOM Library`, `React Form Library`, `React Popper Library`, `Resizable Panel Library`, `Responsive Masonry Library`, `React Routing Library`, `Slick Carousel Library`, `Recharts Chart Library`, `Sonner Notification Library`, `Supabase Client Library`, `Tailwind Merge Library`, `Tailwind Animation Library`, `TypeScript Lint Library`, `TypeScript Parser Library`, `Vaul Drawer Library`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `AuthenticatedUser` connect `Backend Authorization Boundaries` to `Resume Version Management`, `Career Data Models`, `Explainable AI Analysis`, `Resume Dashboard Schemas`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _161 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Authorization Boundaries` be split into smaller, more focused modules?**
  _Cohesion score 0.05526675786593707 - nodes in this community are weakly interconnected._
- **Should `Career Data Models` be split into smaller, more focused modules?**
  _Cohesion score 0.06838106370543542 - nodes in this community are weakly interconnected._
- **Should `Sidebar Layout Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.05279034690799397 - nodes in this community are weakly interconnected._
## Audit Integrity Notes

Graph health warning: 308 dangling-endpoint edges and 26 collapsed endpoint pairs. Verify conclusions against source. Semantic token usage was unavailable from the agent interface; zero token values are placeholders, not measured cost. HTML export and retrieval benchmark were not run because Windows Application Control blocked the graphify executable.
