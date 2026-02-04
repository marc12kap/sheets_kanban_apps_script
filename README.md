# Google Sheets Kanban Board

A flexible, drag-and-drop Kanban board powered by Google Sheets and Apps Script. Works with any column structure—just needs 3 required columns

---

## Setup Instructions

### Step 1: Create Your Google Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like "Kanban Board" or "Project Tasks"

### Step 2: Create the Tasks Sheet

1. Rename the first sheet to **`Tasks`** (exactly this name, case-sensitive)
2. Add column headers in Row 1 with this structure:

| Task ID | Task | Status | Priority | Due Date | Notes |
|---------|------|--------|----------|----------|-------|
| | Build login page | In Progress | High | 2024-02-15 | Use OAuth |
| | Write documentation | Not Started | Medium | | |

**Required columns (in this order):**
- **`Task ID`** - Column A. Leave cells empty—UUIDs are auto-generated
- **`Task`** - The card title displayed on the Kanban board  
- **`Status`** - Defines which Kanban column the task appears in

> **Important:** Create the `Task ID` column header in column A, but leave the cells empty. The system automatically generates unique IDs for each task.

**Optional:** Add any other columns you need (Priority, Due Date, Notes, etc.)—they'll automatically appear in the add/edit modal.

> **Adding tasks directly in the spreadsheet?** See [Step 7b: Enable Auto Task IDs](#step-7b-enable-auto-task-ids-optional-but-recommended) to have IDs generated automatically when you add rows.

> **Tip:** You can sort or filter your `Tasks` sheet by any column (Priority, Due Date, etc.) without affecting the Kanban board order. The board remembers the order you set by dragging cards. The system automatically creates and hides an "Order" column to manage this—you don't need to worry about it.

### Step 3: Create Picklist Sheets

For each column that needs a dropdown, create a sheet named **`Picklist_{ColumnName}`**.

**Example: Status Options**

Create a sheet named **`Picklist_Status`**:

| Value | Color |
|-------|-------|
| Not Started | #95a5a6 |
| In Progress | #3498db |
| Blocked | #e74c3c |
| Complete | #27ae60 |

**Example: Priority Options**

Create a sheet named **`Picklist_Priority`**:

| Value | Color |
|-------|-------|
| High | #e74c3c |
| Medium | #f39c12 |
| Low | #27ae60 |

**How Picklist Sheets Work:**
- Sheet name format: `Picklist_{ColumnName}` (case-insensitive)
- Underscores in sheet names become spaces: `Picklist_Work_Stream` → matches column `Work Stream`
- **Value**: The dropdown option text
- **Color**: Hex color code for visual distinction (optional)

**Any column with a matching Picklist sheet becomes:**
1. A **dropdown** in the add/edit modal
2. A **filter option** in the header bar

The `Picklist_Status` sheet is special—it defines your Kanban columns.

> **Note:** If no `Picklist_Status` sheet exists, a default one is auto-created.

### Step 3b: Create the Owners Sheet (Optional)

If you want to manage team members separately with email linking:

1. Create a new sheet named **`Owners`** (exactly this name, case-sensitive)
2. Set up the following structure in Row 1:

| Name | Email | Color |
|------|-------|-------|
| Marc Kaplan | marc@example.com | #3498db |
| Jane Doe | jane@example.com | #9b59b6 |

**How Owners Works:**
- **Name**: Display name shown in Kanban dropdowns and filter
- **Email**: Google account email (optional, for reference)
- **Color**: Hex color code for visual distinction (optional)

> **Note:** The Owners sheet is auto-created when you first load the Kanban board.

### Setting Up Smart Chips for Owners (Optional)

To allow users to use `@mentions` with Smart Chips in the spreadsheet:

1. Select the **Owner column** in your Tasks sheet (e.g., column F)
2. Go to **Data → Data validation**
3. Set criteria to: **Dropdown (from a range)** → `Owners!A2:A`
4. **Uncheck** "Reject input" to allow `@` override
5. Click **Done**

Now users can either:
- **Pick from dropdown** (plain text, fast)
- **Type `@`** to get a Smart Chip with profile picture (overrides dropdown)

### Picklist vs Owners: What Goes Where?

| Sheet Type | Purpose | Examples |
|------------|---------|----------|
| **Picklist_{Column}** | Task attributes with predefined options | `Picklist_Status`, `Picklist_Priority`, `Picklist_Phase` |
| **Owners** | Team members with email addresses | People who can be assigned to tasks |

**Why separate structures?**
- **Picklist sheets** store simple value + color pairs (2 columns)
- **Owners** stores names, email addresses, AND colors (3 columns)
- When you select an Owner, the name becomes a clickable email link
- Keeps people management separate from workflow configuration

---

## Apps Script Setup

### Step 4: Open Apps Script Editor

1. In your Google Spreadsheet, go to **Extensions → Apps Script**
2. This opens the Apps Script editor in a new tab

### Step 5: Add the Code.gs File

1. The editor opens with a default `Code.gs` file
2. **Delete all existing code** in that file
3. Copy the entire contents of `Code.gs` from this repository
4. Paste it into the editor

### Step 6: Add the Index.html File

1. Click the **+** button next to "Files" in the left sidebar
2. Select **HTML**
3. Name the file **`Index`** (without .html extension—Apps Script adds it automatically)
4. **Delete any default content** in the new file
5. Copy the entire contents of `index.html` from this repository
6. Paste it into the editor

Your project should now have two files:
- `Code.gs`
- `Index.html`

### Step 7: Save the Project

1. Click **File → Save** or press `Ctrl+S` / `Cmd+S`
2. If prompted, name your project (e.g., "Kanban Board")

### Step 7b: Enable Auto Task IDs (Optional but Recommended)

If you plan to add tasks directly in the spreadsheet (not just through the Kanban UI), run this one-time setup to automatically generate Task IDs:

1. In the Apps Script editor, click on the function dropdown (top toolbar, says "Select function")
2. Select **`setupOnEditTrigger`**
3. Click **Run** (▶ button)
4. Authorize when prompted (same permissions as before)

**What this does:** 
- Generates Task IDs for any **existing tasks** that don't have one (backfill)
- Automatically generates Task IDs for **new rows** added in the future
- You never need to manually enter Task IDs

**Tip:** Don't edit the Task ID column directly—let the system manage it. You can protect column A if you want to prevent accidental edits (Data → Protect sheets and ranges).

---

## Deployment

### Step 8: Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**
3. Fill in the deployment settings:
   - **Description**: "Kanban Board v1" (or any description)
   - **Execute as**: "Me" (your account)
   - **Who has access**: Choose based on your needs:
     - "Only myself" - Only you can access
     - "Anyone with Google account" - Requires sign-in
     - "Anyone" - Public access (use with caution)
4. Click **Deploy**

### Step 9: Authorize the App

1. Click **Authorize access** when prompted
2. Choose your Google account
3. Click **Advanced** → **Go to [Project Name] (unsafe)**
4. Click **Allow** to grant permissions

The app needs permission to:
- Read and write to your spreadsheet
- Display web content

### Step 10: Access Your Kanban Board

1. Copy the **Web app URL** shown after deployment
2. Open it in your browser
3. Bookmark it for easy access!

---

## Updating After Changes

If you modify the code:

1. Go to **Deploy → Manage deployments**
2. Click the **pencil icon** ✏️ to edit
3. Change **Version** to "New version"
4. Click **Deploy**

---

## Features

- **Drag-and-drop** tasks between status columns
- **Reorder cards within columns** - Drag cards up/down within a status column to set priority order
- **Sort/filter your sheet freely** - The Kanban board order stays intact even when you sort or filter the spreadsheet
- **Dynamic columns** based on your Picklist sheets
- **Filters** for any configured field (Priority, Category, etc.)
- **Quick search** across all task fields (title, notes, owner, etc.)
- **Collapsible columns** to focus on what matters
- **Add, edit, and delete** tasks through a clean modal interface
- **Works with any spreadsheet structure** - bring your own columns
- **Unique Task IDs** - Auto-generated UUIDs for reliable multi-user support
- **Clickable hyperlinks** - Links in "Related Docs" or similar columns are clickable on cards

---
## Customization Tips

### Adding New Status Columns

Add rows to your `Picklist_Status` sheet:

| Value | Color |
|-------|-------|
| Review | #9b59b6 |
| Testing | #1abc9c |

Refresh your Kanban board to see the new columns.

### Adding Filterable Fields

Create a new Picklist sheet for any column you want as a dropdown/filter.

**Example: Add a Category filter**

1. Create a sheet named `Picklist_Category`:

| Value | Color |
|-------|-------|
| Frontend | #3498db |
| Backend | #e74c3c |
| DevOps | #2ecc71 |

2. Add a "Category" column to your Tasks sheet
3. Refresh the Kanban board—Category now appears as a dropdown and filter

### Column Colors

Use any hex color code for visual distinction:
- `#e74c3c` - Red
- `#f39c12` - Orange
- `#27ae60` - Green
- `#3498db` - Blue
- `#9b59b6` - Purple
- `#95a5a6` - Gray

---

## Card Ordering

You can reorder cards by dragging them up or down within a status column. The order you set persists even if you sort or filter your spreadsheet.

### How to Reorder Cards

- **Within a column**: Drag a card up or down to change its position. Drop it above another card to place it before that card, or drop it in an empty area to move it to the end.
- **Between columns**: Drag a card to a different status column to change its status. It will be added at the position where you drop it.

### Sorting and Filtering Your Sheet

**Good news:** You can sort or filter your `Tasks` sheet by any column (Priority, Due Date, Owner, etc.) without affecting the Kanban board order. The board remembers the order you set by dragging cards, so:

- ✅ Sort by Due Date to see what's coming up
- ✅ Filter by Owner to see someone's tasks
- ✅ Use pivot tables or any other spreadsheet feature
- ✅ The Kanban board order stays exactly as you arranged it

This makes it easy for stakeholders to analyze the data in the spreadsheet while the Kanban board maintains the workflow order you've set up.

---

## Hyperlinks and Related Documents

You can link documents, URLs, or any web resource to your tasks. The Kanban board automatically detects and displays hyperlinks as clickable links.

### How It Works

1. **In your spreadsheet**, add a column with a name containing one of these keywords:
   - `link`, `url`, `doc`, `document`, `related`, `attachment`, `file`, `resource`
   - Examples: "Related Docs", "Document Link", "Attachments", "Resource URL"

2. **Add hyperlinks to cells** using either method:
   - **Rich Text link**: Select the cell → Insert → Link → paste URL
   - **HYPERLINK formula**: `=HYPERLINK("https://...", "Display Text")`

3. **On the Kanban board**:
   - Links appear as clickable blue text on cards
   - Clicking the link opens it in a new tab (doesn't open the edit modal)
   - In the edit modal, you can view and edit both the display text and URL

### Example: Linking Google Docs

| Related Docs |
|--------------|
| [Project Brief](https://docs.google.com/...) |
| [Requirements Doc](https://docs.google.com/...) |

The link text ("Project Brief") shows on the card, and clicking it opens the Google Doc.

### Adding Links via the Kanban Board

When editing a task, link fields show two input boxes:
- **Link text**: The display name shown on the card
- **URL**: The actual link (https://...)

---

## Troubleshooting

### "Tasks sheet must have a Status column"
Make sure your Tasks sheet has a column header named "Status" in Row 1.

### Board shows empty
- Check that your Tasks sheet is named exactly `Tasks`
- Make sure you have at least one task with a Status that matches a Config value

### Changes don't appear
1. Refresh the browser
2. If using a cached deployment, redeploy with a new version

### Authorization errors
- Make sure you authorized the app to access your spreadsheet
- Try redeploying and re-authorizing

### Task IDs are empty or missing
- Make sure you have a `Task ID` column header in column A
- Open the Kanban board once—it auto-fills missing IDs
- Or run `fillMissingTaskIds` from the Apps Script editor
- Don't delete or rename this column—it's required for reliable updates

### Tasks added in spreadsheet don't have Task IDs
- Run `setupOnEditTrigger` once (see Step 7b) to enable auto-generation
- Alternatively, open the Kanban board—it fills in missing IDs automatically
- You can also run `fillMissingTaskIds` manually from the Apps Script editor

### Want to protect the Task ID column?
1. Go to **Data → Protect sheets and ranges**
2. Click **Add a sheet or range**
3. Select just column A (the Task ID column)
4. Click **Set permissions** and choose "Only you" or specific editors
5. This prevents accidental edits while the system still auto-generates IDs

---

## File Structure

```
├── Code.gs      # Backend: Google Apps Script server code
├── index.html   # Frontend: Kanban board UI (HTML/CSS/JS)
└── README.md    # This file
```

---

## License

MIT License - Feel free to use and modify for your projects.
