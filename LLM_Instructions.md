**`loadConfig()`** **NEW!**
- Called first on page load
- Fetches configuration from Config sheet
- Populates all filters and dropdowns dynamically
- Then calls loadTasks()

**`populateFilters()`** **NEW!**
- Populates phase and work stream filter dropdowns
- Uses data from appConfig object

**`populateModalSelects()`** **NEW!**
- Populates all dropdowns in add/edit modals
- Uses data from appConfig object#### `getConfig()` **NEW!**
- Returns configuration from Config sheet
- Provides statuses, work streams, phases
- Auto-creates Config sheet if missing
- Frontend uses this to populate all dropdowns# HELOC Kanban Board - AI Maintenance Guide

## Project Overview
This is a Google Apps Script-based Kanban board for managing HELOC project tasks. It consists of:
- A Google Sheet as the database (single source of truth)
- Apps Script backend (Code.gs) for data operations
- HTML/CSS/JS frontend (Index.html) for the Kanban UI
- Deployed as a web app accessible via URL

## Architecture

### Data Flow
```
Google Sheet
  ├── Config Tab → getConfig() → UI Configuration (statuses, phases, etc.)
  ├── Owners Tab → getOwners() → Team Members (names + emails)
  └── Tasks Tab → getTasks() → Task Data
        ↓
Apps Script Backend (Code.gs)
        ↓
Frontend (Index.html)
        ↓
Kanban Board UI (Dynamic)
```

### File Structure
```
Google Sheet: "HELOC Project - Kanban"
├── Sheet: "Tasks" (task data)
├── Sheet: "Config" (workflow configuration - statuses, phases, work streams)
├── Sheet: "Owners" (team members with emails)
└── Apps Script Project
    ├── Code.gs (backend logic)
    └── Index.html (frontend UI)
```

### Database-Driven Architecture

**The Kanban board is now database-driven!** Statuses, work streams, and phases are stored in the **Config** sheet, not hardcoded in the app. This means:

✅ Add new statuses without touching code  
✅ Customize work streams per project  
✅ Add phases dynamically as project evolves  
✅ Control colors from spreadsheet  

See "Config Sheet Setup Guide" for full details.

### Unique Task ID System

**All task operations use unique UUIDs instead of row numbers.** This provides:

✅ **Reliable updates** - Row deletions don't corrupt references  
✅ **Concurrency safety** - Multiple users can work simultaneously  
✅ **External linking** - Tasks can be referenced from outside the app  
✅ **Audit trail ready** - Stable IDs enable future history tracking  

**How it works:**
1. When a task is created, `generateTaskId()` creates a UUID
2. The ID is stored in the `Task ID` column (auto-created if missing)
3. All update/delete operations use `findRowByTaskId()` to locate the row
4. The frontend stores `_id` on each task object for API calls

**Migration:** Existing spreadsheets without a Task ID column are automatically upgraded. The `ensureTaskIdColumn()` function:
- Inserts a new `Task ID` column at position A
- Generates UUIDs for all existing tasks
- Runs automatically on first `getTasks()` call

**Spreadsheet-added tasks:** Users can add tasks directly in the spreadsheet (not just via the Kanban UI):
- Run `setupOnEditTrigger()` once to enable auto Task ID generation
- The `onEdit()` trigger automatically generates IDs when new rows are added
- Missing IDs are also filled in when the Kanban board loads

### Hyperlink Support

**Links in document-related columns are automatically extracted and displayed as clickable links.**

✅ **Clickable on cards** - Links appear as blue clickable text  
✅ **Opens in new tab** - Clicking doesn't interfere with card editing  
✅ **Supports Rich Text links** - Links inserted via Insert → Link  
✅ **Supports HYPERLINK formulas** - `=HYPERLINK(url, text)` formulas  
✅ **Editable in modal** - Can view and modify both text and URL  
✅ **Searchable** - Search finds matches in link text and URLs  

**How it works:**
1. `getTasks()` identifies columns with link-related names (doc, link, url, related, attachment, file, resource)
2. `extractHyperlink()` checks each cell for Rich Text links or HYPERLINK formulas
3. Link data is returned as `{text: "...", url: "..."}` objects instead of plain strings
4. Frontend renders these as clickable `<a>` tags with `target="_blank"`
5. `updateTaskFieldWithLink()` creates Rich Text links when saving from the UI

**Link-detected column names:** Columns containing these words trigger hyperlink extraction:
- `link`, `url`, `doc`, `document`, `related`, `attachment`, `file`, `resource`

### Card Ordering System

**Cards can be reordered within columns via drag and drop.** The order is persisted in a hidden `Order` column.

✅ **Drag to reorder** - Users can drag cards up/down within a status column  
✅ **Order persists** - Card order is saved to the sheet and survives refresh  
✅ **Sheet can be sorted/filtered** - Order column keeps Kanban order independent of sheet sorting  
✅ **Hidden from users** - Order column is auto-hidden; not shown in cards or edit modal  

**How it works:**
1. `ensureOrderColumn()` creates/manages a hidden `Order` column at the end of the Tasks sheet
2. Each task has a numeric Order value (1, 2, 3...) within its status group
3. Dragging a card calls `moveTaskRow()` which updates Order values
4. `getTasks()` returns tasks sorted by Order within each status
5. Frontend uses optimistic updates for instant visual feedback

**Key functions:**
- `ensureOrderColumn()` - Creates Order column if missing, hides it
- `fillMissingOrderValues()` - Assigns Order values to tasks without one
- `moveTaskRow(taskId, newStatus, beforeTaskId)` - Reorders by updating Order values
- `reorderTaskLocally()` (frontend) - Optimistic local reorder for instant UI response

**User experience:**
- Order field is hidden from card meta display
- Order field is hidden from add/edit modal
- Users can only change order by dragging cards
- Sheet can be sorted/filtered without affecting Kanban order

## Data Schema

### Google Sheet Structure

#### Tasks Sheet
| Column | Position | Type | Description |
|--------|----------|------|-------------|
| Task ID | A (required) | String | Unique identifier - auto-generated UUID |
| Task | B+ (required) | String | Task name/description - **displayed as card title** |
| Status | (required) | String | From Config sheet - defines Kanban column |
| Work Stream | (optional) | String | From Config sheet |
| Phase | (optional) | String | From Config sheet |
| Owner | (optional) | String | Person assigned to task |
| Due Date | (optional) | Date | Target completion date |
| Notes | (optional) | String | Additional context |
| Order | (auto, hidden) | Number | Card position within status column - **system-managed** |

**Important:** 
- Users must create the `Task ID` column header in column A (cells are auto-populated)
- The `Task` column is always used as the card title on the Kanban board
- If Task ID column is missing, the system auto-creates it as a fallback
- The Order column is auto-created and hidden; users should not edit it directly

#### Config Sheet
| Column | Type | Description |
|--------|------|-------------|
| Field | String | "Status", "Work Stream", "Phase", "Priority", etc. |
| Value | String | The actual value (e.g., "In Progress") |
| Color | String | Hex color code (optional, e.g., "#3498db") |

**Config drives the UI**: All dropdowns, filters, columns, and badges are dynamically generated from this sheet.

**What belongs in Config:**
- Status values (defines Kanban columns)
- Work Stream categories
- Phase definitions
- Priority levels
- Any other task attribute with predefined options

**What does NOT belong in Config:**
- Owner entries (use Owners sheet instead)

#### Owners Sheet
| Column | Type | Description |
|--------|------|-------------|
| Name | String | Display name (shown in dropdowns and cards) |
| Email | String | Google account email (enables mailto: linking) |
| Color | String | Hex color code (optional) |

**Owners are separate from Config because:**
- Owners can have additional metadata (email, color)
- Team management is logically separate from workflow configuration
- The Owners sheet can be used as a data validation source for Smart Chips

**Smart Chips support:** For true `@mention` Smart Chips in the spreadsheet:
1. Set up native Sheets data validation on the Owner column pointing to `Owners!A2:A`
2. Uncheck "Reject input" to allow `@` override
3. Users can pick from dropdown OR type `@` for Smart Chip with profile picture

### Config vs Owners Quick Reference

| Use Case | Sheet | Example |
|----------|-------|---------|
| Add a new status column | Config | `Status \| QA Testing \| #9b59b6` |
| Add a new work stream | Config | `Work Stream \| Engineering \| #3498db` |
| Add a new team member | Owners | `John Smith \| john@company.com \| #27ae60` |
| Add a priority level | Config | `Priority \| Critical \| #e74c3c` |

### Frontend Task Object
```javascript
{
  _id: String,          // Unique Task ID (UUID) - PRIMARY IDENTIFIER
  _row: Number,         // Row index (1-based) - kept for backwards compatibility
  'Task ID': String,    // Same as _id, from spreadsheet column
  Task: String,         // Card title - always displayed as title
  'Work Stream': String,
  Phase: String,
  Status: String,
  Owner: String,
  'Due Date': String,   // Formatted as YYYY-MM-DD
  Notes: String,
  Order: Number,        // Position within status column (hidden from UI)
  'Related Docs': String | {text: String, url: String}  // Can be link object
}
```

**Important:** 
- The `_id` field is the primary identifier for all CRUD operations (not row numbers)
- Task IDs are auto-generated UUIDs when creating new tasks
- The `Task` field is always used as the card title, regardless of column order in the spreadsheet
- The `Order` field is system-managed and hidden from the UI (not shown in cards or edit modal)
- **Link fields** (columns with names containing doc, link, url, related, etc.) may be `{text, url}` objects instead of plain strings. Use `isLinkObject(val)` to check.

## Key Functions Reference

### Backend (Code.gs)

#### `generateTaskId()`
- Generates a unique UUID for new tasks
- Uses `Utilities.getUuid()` for guaranteed uniqueness

#### `findRowByTaskId(taskId)`
- Looks up the spreadsheet row number for a given Task ID
- Returns -1 if not found
- Used internally by all CRUD operations

#### `ensureTaskIdColumn()`
- Checks if Tasks sheet has a Task ID column
- Creates one at column A if missing
- Auto-generates IDs for existing tasks without IDs
- Calls `fillMissingTaskIds()` to handle any rows added directly in spreadsheet

#### `fillMissingTaskIds()`
- Scans all rows for missing Task IDs
- Generates UUIDs for any row that has data but no ID
- Called automatically by `ensureTaskIdColumn()` and `onEdit()`

#### `ensureOrderColumn()`
- Creates an Order column at the end of the Tasks sheet if missing
- Initializes Order values for existing tasks (grouped by status)
- Automatically hides the column from users
- Called by `getTasks()` on every load

#### `fillMissingOrderValues()`
- Assigns Order values to tasks that don't have one
- Groups tasks by status and assigns sequential numbers
- Called automatically by `getTasks()`

#### `hideColumnIfVisible(sheet, columnIndex)`
- Helper function to hide a column
- Used to keep the Order column hidden from users

#### `moveTaskRow(taskId, newStatus, beforeTaskId)`
- Reorders a task by updating Order values (not moving rows)
- Handles both within-column reordering and cross-column moves
- Updates status if moving between columns
- Recalculates Order values for all tasks in the target status group
- Called by frontend drag and drop handler

#### `onEdit(e)` - Trigger
- Automatically runs when the Tasks sheet is edited
- Generates Task ID for new rows added directly in spreadsheet
- Requires one-time setup via `setupOnEditTrigger()`

#### `getOwners()`
- Returns all owners from the Owners sheet
- Each owner includes: name, email, color
- Auto-creates Owners sheet if missing
- Used by `getConfig()` to populate Owner options for Kanban UI

#### `setupOnEditTrigger()`
- **Run once** to enable auto Task ID generation for spreadsheet edits
- Creates an onEdit trigger for the spreadsheet
- Removes duplicate triggers if run multiple times

#### `extractHyperlink(sheet, row, col, displayValue)`
- Extracts hyperlink information from a cell
- Checks for HYPERLINK formulas first, then Rich Text links
- Returns `{text, url}` object if link found, otherwise the original value
- Used by `getTasks()` to detect links in document-related columns

#### `getTasks()`
- Returns all tasks from the sheet as JSON array
- Ensures Task ID column exists
- Each task includes `_id` (UUID) and `_row` (for compatibility)
- **Extracts hyperlinks** from columns with names containing: link, url, doc, document, related, attachment, file, resource
- Link values are returned as `{text: "...", url: "..."}` objects

#### `updateTaskStatus(taskId, newStatus)`
- Updates the Status column for a specific task
- Called when dragging cards between columns
- **Uses Task ID (not row number)** to find the correct row

#### `updateTaskField(taskId, fieldName, newValue)`
- Updates any single field for a task
- **Uses Task ID (not row number)** to find the correct row

#### `updateTaskFieldWithLink(taskId, fieldName, displayText, url)`
- Updates a field with a Rich Text hyperlink
- Creates a clickable link in the cell using `SpreadsheetApp.newRichTextValue()`
- Called by frontend when saving tasks with link fields that have both text and URL
- If only text provided (no URL), saves as plain text

#### `updateTask(taskId, taskData)`
- Updates multiple fields for a task at once
- **Uses Task ID (not row number)** to find the correct row
- Prevents modification of the Task ID itself

#### `addTask(taskData)`
- Appends new task to bottom of sheet
- **Auto-generates a unique Task ID (UUID)**
- Returns success status and the new Task ID

#### `deleteTask(taskId)`
- Deletes entire row from sheet
- **Uses Task ID (not row number)** to find the correct row
- Cannot be undone

### Frontend (Index.html)

#### State Management
```javascript
let allTasks = [];              // All tasks loaded from backend
let appConfig = null;           // Configuration from Config sheet (NEW!)
let statuses = [];              // Array of status values from config (NEW!)
let draggedCard = null;         // Currently dragged card
let isDragging = false;         // Prevents click during drag
let currentEditingTaskId = null; // Task being edited in modal
```

#### Key Functions

**`loadTasks()`**
- Fetches tasks from backend via `google.script.run`
- Calls `renderBoard()` on success

**`renderBoard(tasks)`**
- Filters tasks based on phase/workstream filters
- Groups tasks by status
- Renders 4 columns with cards
- Sets up drag & drop listeners

**`renderTaskCard(task)`**
- Returns HTML string for a single card
- Applies color-coding based on phase and workstream
- Shows owner and due date if present

**`openEditTaskModal(taskId)`**
- Finds task in allTasks array
- Populates edit form fields
- Shows modal overlay

**`saveEditedTask()`**
- Collects all form values
- Calls `updateTask()` for each field
- Refreshes board when all updates complete

**Drag and Drop Functions:**

**`handleDragStart(e)`**
- Marks card as dragging, stores task ID
- Sets up data transfer for drop

**`handleDragOver(e)`**
- Shows visual drop indicator
- Calculates insertion point based on mouse position

**`handleDrop(e)`**
- Determines target status and insertion position
- Calls `reorderTaskLocally()` for instant visual feedback
- Fires `moveTaskRow()` to backend (fire-and-forget for speed)

**`reorderTaskLocally(taskId, newStatus, beforeTaskId)`**
- Optimistic update: reorders tasks in local array
- Updates Order values locally for immediate visual feedback
- Called before backend save for instant UI response

**`getDragAfterElement(container, y)`**
- Calculates which card the dragged item should be inserted before
- Uses mouse Y position and card bounding boxes

**Hyperlink Helper Functions:**

**`isLinkObject(val)`**
- Returns true if value is a hyperlink object `{text, url}`
- Used throughout rendering to detect link fields

**`getDisplayValue(val)`**
- Returns display text from either a plain value or link object
- Handles both `"text"` and `{text: "text", url: "..."}` formats

**`isLinkField(fieldName)`**
- Returns true if field name suggests it contains links
- Checks for: link, url, doc, document, related, attachment, file, resource

**`toggleLinkEdit(fieldId, fieldName)`**
- Toggles between link display view and edit inputs in modal
- Allows users to edit existing links or add new ones

## Common Modifications

### Adding a New Status Column
**NEW: Database-driven approach!**

1. **Open Google Sheet → Config tab**
2. **Add new row:**
   - Section: `Status`
   - Value: `Your New Status`
   - Color: `#hexcolor` (optional)
3. **Refresh Kanban board** - Done! No code changes needed.

The UI automatically:
- Creates new column
- Adds to all status dropdowns
- Applies color to badges

### Adding a New Work Stream
**NEW: Database-driven approach!**

1. **Open Config sheet**
2. **Add new row:**
   - Section: `Work Stream`
   - Value: `Your Work Stream`
   - Color: `#hexcolor` (optional)
3. **Refresh Kanban board** - That's it!

### Adding a New Phase
**NEW: Database-driven approach!**

1. **Open Config sheet**
2. **Add new row:**
   - Section: `Phase`
   - Value: `Phase 2`
   - Color: `#hexcolor` (optional)
3. **Refresh board**

**Old way (deprecated):**
~~You had to update JavaScript constants and multiple dropdowns in code~~ 🎉

### Adding a New Owner/Team Member

1. **Open Owners sheet** (not Config!)
2. **Add new row:**
   - Name: `John Smith`
   - Email: `john@company.com`
   - Color: `#hexcolor` (optional)
3. **Refresh Kanban board** - Owner appears in dropdown

**Auto-linking:** When you select an owner in the Tasks sheet, their name automatically becomes a clickable mailto: link to their email address.

### Adding a New Field
1. **Add Column to Google Sheet**
   - Insert column in Tasks sheet
   - Update header row

2. **Update Backend `getTasks()`**
   ```javascript
   tasks.push({
     // ... existing fields ...
     yourNewField: data[i][COLUMN_INDEX]
   });
   ```

3. **Update Backend `updateTask()` columnMap**
   ```javascript
   var columnMap = {
     // ... existing fields ...
     'yourNewField': COLUMN_NUMBER
   };
   ```

4. **Add to Frontend Forms**
   - Add input/select in add task modal
   - Add input/select in edit task modal
   - Update `addNewTask()` to include new field
   - Update `saveEditedTask()` to include new field

### Changing Column Order/Layout
Modify the grid in CSS:
```css
.kanban-board {
  grid-template-columns: repeat(4, 1fr); /* Change 4 to desired number */
  /* or use specific sizes */
  grid-template-columns: 300px 300px 300px 300px;
}
```

### Adding Keyboard Shortcuts
Add to end of Index.html `<script>`:
```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'n' && e.ctrlKey) {
    e.preventDefault();
    openAddTaskModal();
  }
  // Add more shortcuts...
});
```

## Styling Guide

### Color Scheme
- Primary Blue: `#3498db`
- Success Green: `#27ae60`
- Warning Red: `#e74c3c`
- Gray: `#95a5a6`
- Background: `#f5f6f8`
- Card Background: `white`
- Text: `#2c3e50`

### Work Stream Colors
- Compliance: `#e8f8f5` / `#16a085`
- Capital Markets: `#fdeef4` / `#8e44ad`
- Loan Operations: `#e8f4f8` / `#2980b9`
- Approval/Valuations: `#fef9e7` / `#d68910`
- Product: `#f4ecf7` / `#7d3c98`
- Sales/Marketing: `#eafaf1` / `#229954`

### Phase Colors
- Phase 0: `#fee` / `#c0392b`
- Phase 1: `#fef6e0` / `#f39c12`

## Deployment

### Initial Deployment
1. Extensions → Apps Script
2. Deploy → New deployment
3. Select type: Web app
4. Execute as: Me
5. Who has access: Anyone with the link
6. Deploy → Copy web app URL

### Redeployment (After Changes)
1. Make changes to Code.gs or Index.html
2. Save files (Ctrl+S)
3. Deploy → Manage deployments
4. Click edit icon (pencil) on current deployment
5. Version: New version
6. Deploy
7. **No need to change URL - it updates automatically**

## Troubleshooting

### "Script not found" Error
- Check HTML file is named exactly "Index" (capital I)
- Verify doGet() function exists in Code.gs

### Tasks Not Loading
- Check sheet name is exactly "Tasks"
- Verify getTasks() function is not modified
- Check browser console for errors (F12)

### Drag & Drop Not Working
- Ensure cards have `draggable="true"` attribute
- Check drag event handlers are attached (`handleDragStart`, `handleDragEnd`, `handleDragOver`, `handleDragLeave`, `handleDrop`)
- Verify the Order column exists in the Tasks sheet (auto-created, may be hidden)
- Check browser console for errors from `moveTaskRow()`
- Ensure `reorderTaskLocally()` is called for optimistic updates

### Edit Modal Not Opening
- Check double-click event listener is attached
- Verify `openEditTaskModal()` receives valid taskId
- Ensure allTasks array is populated

### Updates Not Saving
- Check Google Sheets API permissions
- Verify Task ID exists in the spreadsheet (check Task ID column)
- Ensure the Task ID column wasn't accidentally deleted or renamed
- Look for errors in Apps Script execution logs (Apps Script → Executions)

## Security Notes

### Permissions
- Apps Script runs as the sheet owner
- Anyone with web app link can view/edit tasks
- Data is stored in owner's Google Drive

### Restricting Access
To limit who can access:
1. Deploy → Manage deployments
2. Edit deployment
3. Change "Who has access" to "Only me" or "Specific users"

## Performance Considerations

### Current Limitations
- All tasks load at once (no pagination)
- Each field update is a separate API call
- No caching between page loads

### Optimization Opportunities
1. **Batch Updates**: Combine multiple field updates into single call
2. **Local Caching**: Store tasks in localStorage
3. **Lazy Loading**: Load tasks on demand
4. **Debouncing**: Delay rapid status changes

### Implemented Optimizations
1. **Optimistic Updates**: Drag and drop uses fire-and-forget pattern
   - UI updates instantly via `reorderTaskLocally()`
   - Backend save happens in background
   - Only refreshes on error
2. **Local Reordering**: Order changes update local array immediately
   - No waiting for backend response
   - Smooth, lag-free drag experience

### Recommended Task Limits
- Optimal: < 200 tasks
- Good performance: < 500 tasks
- Consider pagination: > 500 tasks

## AI Assistant Guidelines

When helping maintain this project:

1. **Always check the current code** before suggesting changes
2. **Test changes incrementally** - one feature at a time
3. **Preserve existing functionality** unless explicitly asked to change
4. **Maintain the data schema** - changes affect both frontend and backend
5. **Update all 3 locations** when adding fields/statuses (backend, add modal, edit modal)
6. **Keep the Google Sheet as source of truth** - frontend is read-only display
7. **Use semantic variable names** for new features
8. **Follow existing code style** (spacing, naming conventions)
9. **Update this guide** when making architectural changes

## Quick Reference Commands

### Testing Changes Locally
1. Make changes in Apps Script editor
2. Save (Ctrl+S)
3. No need to redeploy during testing
4. Refresh web app URL to see changes

### Debugging
```javascript
// Add to any function in Code.gs
Logger.log('Debug message: ' + variable);

// View logs
Apps Script → Executions → View logs
```

### Resetting Data
1. Open Google Sheet
2. Delete all rows except header
3. Re-import CSV or manually add tasks

## Future Enhancement Ideas

- [ ] Bulk actions (multi-select cards)
- [ ] Task templates
- [ ] Commenting system
- [x] File attachments / document links (via hyperlink support)
- [ ] Activity history/audit log
- [ ] Email notifications
- [ ] Calendar integration
- [ ] Export to PDF/CSV
- [ ] Custom fields
- [ ] Subtasks/checklists
- [ ] Time tracking
- [ ] Sprint planning view
- [ ] Mobile responsive improvements

---

**Last Updated**: January 20, 2026  
**Maintained By**: AI Assistant + Project Team  
**Questions?** Refer to setup instructions or modify this guide as needed.
