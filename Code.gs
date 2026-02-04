// Code.gs - Flexible Kanban Board
// Only requires: "Status" column in Tasks sheet and Config sheet
// Uses unique Task IDs for reliable updates (not row numbers)

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Kanban Board')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gets the spreadsheet title for the header
 */
function getSpreadsheetTitle() {
  return SpreadsheetApp.getActiveSpreadsheet().getName();
}

/**
 * Generates a unique ID for tasks
 * Uses UUID v4 format for guaranteed uniqueness
 */
function generateTaskId() {
  return Utilities.getUuid();
}

/**
 * Finds the row number for a given task ID
 * Returns -1 if not found
 */
function findRowByTaskId(taskId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
  
  // Find the Task ID column (check common variations)
  var idColIndex = headers.findIndex(function(h) {
    return h === 'task id' || h === 'taskid' || h === 'id';
  });
  
  if (idColIndex === -1) return -1;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]).trim() === String(taskId).trim()) {
      return i + 1; // Return 1-indexed row number
    }
  }
  
  return -1;
}

/**
 * Gets or creates the Task ID column index
 * Ensures the Tasks sheet has a Task ID column
 */
function ensureTaskIdColumn() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerLower = headers.map(function(h) { return String(h).trim().toLowerCase(); });
  
  var idColIndex = headerLower.findIndex(function(h) {
    return h === 'task id' || h === 'taskid' || h === 'id';
  });
  
  // If no ID column exists, insert one at the beginning
  if (idColIndex === -1) {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue('Task ID');
    idColIndex = 0;
    
    // Generate IDs for existing rows
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      for (var i = 2; i <= lastRow; i++) {
        sheet.getRange(i, 1).setValue(generateTaskId());
      }
    }
  }
  
  // Also fill in any missing IDs (for rows added directly in spreadsheet)
  fillMissingTaskIds();
  
  return idColIndex;
}

/**
 * Hides a column if it's not already hidden
 * @param {Sheet} sheet - The sheet object
 * @param {number} columnIndex - 0-based column index
 */
function hideColumnIfVisible(sheet, columnIndex) {
  try {
    var columnPosition = columnIndex + 1; // Convert to 1-based
    // hideColumns() is idempotent - safe to call even if already hidden
    sheet.hideColumns(columnPosition);
  } catch (e) {
    // Silently fail if hiding isn't possible (permissions, etc.)
    Logger.log('Could not hide column: ' + e.toString());
  }
}

/**
 * Gets or creates the Order column index
 * Ensures the Tasks sheet has an Order column for Kanban card ordering
 * The Order column stores numeric values that determine card position within each status
 * The column is automatically hidden to keep the sheet view clean
 */
function ensureOrderColumn() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerLower = headers.map(function(h) { return String(h).trim().toLowerCase(); });
  
  var orderColIndex = headerLower.findIndex(function(h) {
    return h === 'order' || h === 'kanban order' || h === 'sort order';
  });
  
  // If no Order column exists, add one at the end
  if (orderColIndex === -1) {
    var lastCol = sheet.getLastColumn();
    orderColIndex = lastCol;
    sheet.getRange(1, lastCol + 1).setValue('Order');
    
    // Initialize Order values for existing tasks (grouped by status)
    var statusColIndex = headerLower.findIndex(function(h) {
      return h === 'status';
    });
    
    if (statusColIndex !== -1) {
      var data = sheet.getDataRange().getValues();
      var statusOrderMap = {}; // Track order within each status
      
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        // Skip empty rows
        if (!row.some(function(cell, idx) { return idx !== orderColIndex && cell !== ''; })) continue;
        
        var status = String(row[statusColIndex] || '').trim();
        if (!status) continue;
        
        // Initialize order counter for this status if needed
        if (!statusOrderMap[status]) {
          statusOrderMap[status] = 0;
        }
        
        // Set order value (incrementing within each status)
        statusOrderMap[status]++;
        sheet.getRange(i + 1, orderColIndex + 1).setValue(statusOrderMap[status]);
      }
    }
  }
  
  // Always ensure the column is hidden (idempotent operation)
  hideColumnIfVisible(sheet, orderColIndex);
  
  return orderColIndex;
}

/**
 * Fills in missing Task IDs for any rows that don't have one
 * Called automatically when loading tasks, and via onEdit trigger
 */
function fillMissingTaskIds() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  if (!sheet) return;
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerLower = headers.map(function(h) { return String(h).trim().toLowerCase(); });
  
  var idColIndex = headerLower.findIndex(function(h) {
    return h === 'task id' || h === 'taskid' || h === 'id';
  });
  
  if (idColIndex === -1) return; // No ID column yet
  
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var taskId = String(row[idColIndex]).trim();
    
    // Check if row has data but no Task ID
    var hasData = row.some(function(cell, idx) {
      return idx !== idColIndex && cell !== '';
    });
    
    if (hasData && !taskId) {
      // Generate and set a new Task ID
      sheet.getRange(i + 2, idColIndex + 1).setValue(generateTaskId());
    }
  }
}

/**
 * Fills in missing Order values for tasks within each status group
 * Called automatically when loading tasks to ensure all tasks have Order values
 */
function fillMissingOrderValues() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  if (!sheet) return;
  
  ensureOrderColumn(); // Make sure column exists
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerLower = headers.map(function(h) { return String(h).trim().toLowerCase(); });
  
  var statusColIndex = headerLower.findIndex(function(h) {
    return h === 'status';
  });
  if (statusColIndex === -1) return; // No Status column
  
  var orderColIndex = headerLower.findIndex(function(h) {
    return h === 'order' || h === 'kanban order' || h === 'sort order';
  });
  if (orderColIndex === -1) return; // No Order column
  
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var statusOrderMap = {}; // Track order within each status
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var status = String(row[statusColIndex] || '').trim();
    var orderValue = row[orderColIndex];
    
    // Skip empty rows
    if (!row.some(function(cell, idx) { return idx !== orderColIndex && cell !== ''; })) continue;
    
    if (!status) continue; // Skip rows without status
    
    // Initialize order counter for this status if needed
    if (!statusOrderMap[status]) {
      statusOrderMap[status] = 0;
    }
    
    // If order is missing or invalid, assign a new one
    if (!orderValue || orderValue === '' || isNaN(Number(orderValue))) {
      statusOrderMap[status]++;
      sheet.getRange(i + 2, orderColIndex + 1).setValue(statusOrderMap[status]);
    } else {
      // Track the highest order value for this status
      var currentOrder = Number(orderValue);
      if (currentOrder > statusOrderMap[status]) {
        statusOrderMap[status] = currentOrder;
      }
    }
  }
}

/**
 * Trigger: Auto-generates Task IDs when rows are added/edited in spreadsheet
 * Also auto-links Owner names to their email addresses
 * This runs automatically when anyone edits the Tasks sheet
 * 
 * SETUP: Run setupOnEditTrigger() once to enable this functionality
 */
function onEdit(e) {
  // Only process edits to the Tasks sheet
  if (!e || !e.range) return;
  
  var sheet = e.range.getSheet();
  if (sheet.getName() !== 'Tasks') return;
  
  // Skip header row
  var row = e.range.getRow();
  if (row === 1) return;
  
  // Check if this row needs a Task ID
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerLower = headers.map(function(h) { return String(h).trim().toLowerCase(); });
  
  var idColIndex = headerLower.findIndex(function(h) {
    return h === 'task id' || h === 'taskid' || h === 'id';
  });
  
  if (idColIndex === -1) return; // No ID column
  
  // Get current Task ID for this row
  var currentId = sheet.getRange(row, idColIndex + 1).getValue();
  
  // If no Task ID but row has data, generate one
  if (!currentId || String(currentId).trim() === '') {
    var rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    var hasData = rowData.some(function(cell, idx) {
      return idx !== idColIndex && cell !== '';
    });
    
    if (hasData) {
      sheet.getRange(row, idColIndex + 1).setValue(generateTaskId());
    }
  }
  
}

/**
 * Run this function ONCE to set up the automatic Task ID generation
 * Also backfills any existing tasks that don't have Task IDs
 * Goes to: Apps Script Editor → Run → setupOnEditTrigger
 */
function setupOnEditTrigger() {
  // Remove any existing onEdit triggers to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new onEdit trigger
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  
  // Backfill any existing tasks without Task IDs
  ensureTaskIdColumn();
  
  var count = countTasksWithIds();
  Logger.log('Setup complete! ' + count + ' tasks now have Task IDs.');
  
  return { success: true, message: 'Task ID auto-generation enabled! ' + count + ' tasks have IDs.' };
}

/**
 * Counts how many tasks have Task IDs (for reporting)
 */
function countTasksWithIds() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  if (!sheet) return 0;
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerLower = headers.map(function(h) { return String(h).trim().toLowerCase(); });
  
  var idColIndex = headerLower.findIndex(function(h) {
    return h === 'task id' || h === 'taskid' || h === 'id';
  });
  
  if (idColIndex === -1) return 0;
  
  var ids = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  var count = 0;
  ids.forEach(function(row) {
    if (row[0] && String(row[0]).trim() !== '') count++;
  });
  
  return count;
}

/**
 * Extracts hyperlink information from a cell
 * Supports both Rich Text links and HYPERLINK() formulas
 * @param {Sheet} sheet - The sheet object
 * @param {number} row - Row number (1-indexed)
 * @param {number} col - Column number (1-indexed)
 * @param {*} displayValue - The already-fetched display value
 * @returns {Object|*} - Returns {text, url} if hyperlink found, otherwise the original value
 */
function extractHyperlink(sheet, row, col, displayValue) {
  try {
    var cell = sheet.getRange(row, col);
    
    // First, check for HYPERLINK formula
    var formula = cell.getFormula();
    if (formula && formula.toUpperCase().indexOf('=HYPERLINK') === 0) {
      // Parse HYPERLINK(url, text) or HYPERLINK(url)
      var match = formula.match(/=HYPERLINK\s*\(\s*"([^"]+)"(?:\s*,\s*"([^"]*)")?\s*\)/i);
      if (match) {
        return {
          text: match[2] || match[1] || String(displayValue),
          url: match[1]
        };
      }
    }
    
    // Check for Rich Text link
    var richText = cell.getRichTextValue();
    if (richText) {
      var url = richText.getLinkUrl();
      if (url) {
        return {
          text: String(displayValue),
          url: url
        };
      }
      
      // Check individual runs (for partial links)
      var runs = richText.getRuns();
      for (var i = 0; i < runs.length; i++) {
        var runUrl = runs[i].getLinkUrl();
        if (runUrl) {
          return {
            text: String(displayValue),
            url: runUrl
          };
        }
      }
    }
  } catch (e) {
    // If anything fails, just return the original value
    Logger.log('Error extracting hyperlink: ' + e.toString());
  }
  
  return displayValue;
}

/**
 * Gets all initial data in a single call to reduce round-trips
 */
function getInitialData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    schema: getSchema(),
    config: getConfig(),
    tasks: getTasks(),
    title: ss.getName()
  };
}

/**
 * Gets column headers and all task data dynamically
 * Optimized to fetch all data in bulk to minimize server calls
 */
function getTasks() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  if (!sheet) return { headers: [], tasks: [] };

  // Ensure Task ID and Order columns exist
  ensureTaskIdColumn();
  ensureOrderColumn();
  fillMissingOrderValues();

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  
  if (lastRow < 1) return { headers: [], tasks: [] };

  // Bulk fetch everything we might need
  var range = sheet.getRange(1, 1, lastRow, lastCol);
  var values = range.getValues();
  var formulas = range.getFormulas();
  var richTextValues = range.getRichTextValues();
  
  var headers = values[0].map(function(h) { return String(h).trim(); });
  var headerLower = headers.map(function(h) { return String(h).trim().toLowerCase(); });
  
  var statusIndex = headerLower.findIndex(function(h) { return h === 'status'; });
  if (statusIndex === -1) throw new Error('Tasks sheet must have a "Status" column');
  
  var idIndex = headerLower.findIndex(function(h) { return h === 'task id' || h === 'taskid' || h === 'id'; });
  var orderIndex = headerLower.findIndex(function(h) { return h === 'order' || h === 'kanban order' || h === 'sort order'; });
  
  // Identify columns that commonly contain links
  var linkColumnIndices = [];
  headerLower.forEach(function(h, idx) {
    if (h.indexOf('link') !== -1 || h.indexOf('url') !== -1 || h.indexOf('doc') !== -1 || 
        h.indexOf('document') !== -1 || h.indexOf('related') !== -1 || h.indexOf('attachment') !== -1 || 
        h.indexOf('file') !== -1 || h.indexOf('resource') !== -1) {
      linkColumnIndices.push(idx);
    }
  });
  
  var tasks = [];
  for (var i = 1; i < values.length; i++) {
    var rowValues = values[i];
    var rowFormulas = formulas[i];
    var rowRichText = richTextValues[i];
    
    // Skip empty rows
    if (!rowValues.some(function(cell) { return cell !== ''; })) continue;
    
    var task = { _row: i + 1 };
    
    headers.forEach(function(header, idx) {
      var value = rowValues[idx];
      
      // Format dates
      if (value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      
      // Check for hyperlinks in link-related columns (bulk processing)
      if (linkColumnIndices.indexOf(idx) !== -1 && value !== '' && value !== null && value !== undefined) {
        var linkFound = false;
        
        // 1. Check for HYPERLINK formula
        var formula = rowFormulas[idx];
        if (formula && formula.toUpperCase().indexOf('=HYPERLINK') === 0) {
          var match = formula.match(/=HYPERLINK\s*\(\s*"([^"]+)"(?:\s*,\s*"([^"]*)")?\s*\)/i);
          if (match) {
            value = { text: match[2] || match[1] || String(value), url: match[1] };
            linkFound = true;
          }
        }
        
        // 2. Check for Rich Text link if formula didn't yield one
        if (!linkFound) {
          var richText = rowRichText[idx];
          if (richText) {
            var url = richText.getLinkUrl();
            if (!url) {
              var runs = richText.getRuns();
              for (var j = 0; j < runs.length; j++) {
                var runUrl = runs[j].getLinkUrl();
                if (runUrl) { url = runUrl; break; }
              }
            }
            if (url) {
              value = { text: String(value), url: url };
            }
          }
        }
      }
      
      task[header] = value !== undefined ? value : '';
    });
    
    // Ensure _id is set
    if (idIndex !== -1 && task[headers[idIndex]]) {
      task._id = String(task[headers[idIndex]]);
    } else {
      task._id = task._row.toString();
    }
    
    // Ensure Order value exists
    if (orderIndex !== -1) {
      var orderValue = task[headers[orderIndex]];
      task[headers[orderIndex]] = (orderValue === '' || isNaN(Number(orderValue))) ? i : Number(orderValue);
    }
    
    tasks.push(task);
  }
  
  // Sort tasks
  tasks.sort(function(a, b) {
    var statusA = String(a['Status'] || '').toLowerCase();
    var statusB = String(b['Status'] || '').toLowerCase();
    if (statusA !== statusB) return statusA.localeCompare(statusB);
    if (orderIndex !== -1) {
      return (Number(a[headers[orderIndex]]) || 0) - (Number(b[headers[orderIndex]]) || 0);
    }
    return a._row - b._row;
  });
  
  return { headers: headers, tasks: tasks };
}

/**
 * Gets configuration from Picklist sheets and Owners sheet
 * 
 * Picklist sheets: Named "Picklist_{ColumnName}" with format: Value | Color
 * - Example: "Picklist_Status" provides options for the Status column
 * - Case-insensitive matching (Picklist_status = Picklist_Status)
 * 
 * Any column with a matching Picklist sheet becomes:
 * 1. A dropdown in the add/edit modal
 * 2. A filter option in the UI
 * 
 * "Status" is special - it defines the Kanban columns
 * "Owner" is loaded from the separate Owners sheet (Name | Email | Color)
 */
function getConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var config = {};
  
  // Find all Picklist_* sheets (case-insensitive)
  sheets.forEach(function(sheet) {
    var sheetName = sheet.getName();
    var lowerName = sheetName.toLowerCase();
    
    // Check if sheet name starts with "picklist_"
    if (lowerName.indexOf('picklist_') === 0) {
      // Extract the column name (part after "Picklist_")
      // Convert underscores to spaces to match column headers
      // e.g., "Picklist_Work_Stream" -> "Work Stream"
      var columnName = sheetName.substring(9).replace(/_/g, ' '); // Length of "Picklist_"
      
      if (!columnName) return; // Skip if no column name
      
      var data = sheet.getDataRange().getValues();
      var options = [];
      
      // Parse: Value | Color (skip header row)
      for (var i = 1; i < data.length; i++) {
        var value = String(data[i][0]).trim();
        var color = String(data[i][1] || '').trim();
        
        if (!value) continue;
        
        options.push({ value: value, color: color });
      }
      
      if (options.length > 0) {
        config[columnName] = options;
      }
    }
  });
  
  // Ensure Status exists (create default Picklist_Status if needed)
  if (!config['Status']) {
    var statusSheet = createPicklistSheet(ss, 'Status', [
      ['Not Started', '#95a5a6'],
      ['In Progress', '#3498db'],
      ['Blocked', '#e74c3c'],
      ['Complete', '#27ae60']
    ]);
    config['Status'] = [
      { value: 'Not Started', color: '#95a5a6' },
      { value: 'In Progress', color: '#3498db' },
      { value: 'Blocked', color: '#e74c3c' },
      { value: 'Complete', color: '#27ae60' }
    ];
  }
  
  // Load owners from Owners sheet
  var owners = getOwners();
  if (owners.length > 0) {
    config['Owner'] = owners.map(function(o) {
      return { value: o.name, color: o.color || '', email: o.email };
    });
  }
  
  return config;
}

/**
 * Creates a new Picklist sheet with default values
 * @param {Spreadsheet} ss - The spreadsheet
 * @param {string} columnName - The column name (used in sheet name)
 * @param {Array} values - Array of [value, color] pairs
 * @returns {Sheet} The created sheet
 */
function createPicklistSheet(ss, columnName, values) {
  var sheetName = 'Picklist_' + columnName;
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Header row
    sheet.getRange('A1:B1').setValues([['Value', 'Color']]);
    sheet.getRange('A1:B1').setFontWeight('bold').setBackground('#3498db').setFontColor('#fff');
    
    // Add values
    if (values && values.length > 0) {
      sheet.getRange(2, 1, values.length, 2).setValues(values);
    }
    
    sheet.autoResizeColumns(1, 2);
    
    // Add instructions
    sheet.getRange('D1').setValue('Instructions:');
    sheet.getRange('D2').setValue('Add dropdown options for the "' + columnName + '" column');
    sheet.getRange('D3').setValue('Value = the option text, Color = hex color (optional)');
  }
  
  return sheet;
}

/**
 * Gets owners from the Owners sheet
 * Owners sheet format: Name | Email | Color (optional)
 */
function getOwners() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ownersSheet = ss.getSheetByName('Owners');
  
  if (!ownersSheet) {
    ownersSheet = ss.insertSheet('Owners');
    initializeOwnersSheet(ownersSheet);
  }
  
  var data = ownersSheet.getDataRange().getValues();
  var owners = [];
  
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][0]).trim();
    var email = String(data[i][1] || '').trim();
    var color = String(data[i][2] || '').trim();
    
    if (!name) continue;
    
    owners.push({
      name: name,
      email: email,
      color: color
    });
  }
  
  return owners;
}

/**
 * Creates default Owners sheet
 */
function initializeOwnersSheet(sheet) {
  sheet.getRange('A1:C1').setValues([['Name', 'Email', 'Color']]);
  sheet.getRange('A1:C1').setFontWeight('bold').setBackground('#9b59b6').setFontColor('#fff');
  
  sheet.autoResizeColumns(1, 3);
  sheet.setColumnWidth(2, 200);
  
  sheet.getRange('E1').setValue('Instructions:');
  sheet.getRange('E2').setValue('Add team members here for Kanban UI filters');
  sheet.getRange('E3').setValue('For Smart Chips: use Data Validation on Owner column');
  sheet.getRange('E4').setValue('  → Data > Data validation > Dropdown from range: Owners!A2:A');
  sheet.getRange('E5').setValue('  → Uncheck "Reject input" to allow @ override');
  sheet.getRange('E6').setValue('Users can then pick from dropdown OR type @ for Smart Chip');
}


/**
 * Updates a task's status (for drag-and-drop)
 * @param {string} taskId - The unique task ID
 * @param {string} newStatus - The new status value
 */
function updateTaskStatus(taskId, newStatus) {
  var row = findRowByTaskId(taskId);
  if (row === -1) {
    throw new Error('Task not found with ID: ' + taskId);
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  var statusCol = headers.findIndex(function(h) { 
    return String(h).trim().toLowerCase() === 'status'; 
  });
  
  if (statusCol === -1) throw new Error('Status column not found');
  
  sheet.getRange(row, statusCol + 1).setValue(newStatus);
  return { success: true };
}

/**
 * Updates task order by modifying Order column values
 * Optimized to reduce sheet calls and batch where possible
 */
function moveTaskRow(taskId, newStatus, beforeTaskId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  ensureOrderColumn();
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var dataRange = sheet.getRange(1, 1, lastRow, lastCol);
  var data = dataRange.getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var headerLower = headers.map(function(h) { return String(h).trim().toLowerCase(); });
  
  var statusColIndex = headerLower.findIndex(function(h) { return h === 'status'; });
  var idColIndex = headerLower.findIndex(function(h) { return h === 'task id' || h === 'taskid' || h === 'id'; });
  var orderColIndex = headerLower.findIndex(function(h) { return h === 'order' || h === 'kanban order' || h === 'sort order'; });
  
  if (statusColIndex === -1 || idColIndex === -1 || orderColIndex === -1) {
    throw new Error('Required columns missing');
  }
  
  // Find source task
  var sourceRowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]).trim() === String(taskId).trim()) {
      sourceRowIdx = i;
      break;
    }
  }
  if (sourceRowIdx === -1) throw new Error('Task not found: ' + taskId);
  
  var oldStatus = String(data[sourceRowIdx][statusColIndex]).trim();
  var targetStatus = (newStatus && newStatus.trim()) ? newStatus.trim() : oldStatus;
  
  // Update status in sheet if changed
  if (oldStatus !== targetStatus) {
    sheet.getRange(sourceRowIdx + 1, statusColIndex + 1).setValue(targetStatus);
    data[sourceRowIdx][statusColIndex] = targetStatus; // Update local data for sorting
  }
  
  // Collect all tasks in target status
  var statusTasks = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][statusColIndex]).trim() === targetStatus) {
      statusTasks.push({
        row: i + 1,
        taskId: String(data[i][idColIndex]).trim(),
        order: Number(data[i][orderColIndex]) || 0
      });
    }
  }
  
  // Sort and reorder
  statusTasks.sort(function(a, b) { return a.order - b.order; });
  
  var sourceIndex = statusTasks.findIndex(function(t) { return t.taskId === taskId; });
  var targetIndex = statusTasks.length - 1;
  if (beforeTaskId) {
    var foundIdx = statusTasks.findIndex(function(t) { return t.taskId === beforeTaskId; });
    if (foundIdx !== -1) {
      targetIndex = foundIdx;
      if (sourceIndex !== -1 && sourceIndex < targetIndex) targetIndex--;
    }
  }
  
  if (sourceIndex !== -1) {
    var movedTask = statusTasks.splice(sourceIndex, 1)[0];
    statusTasks.splice(targetIndex, 0, movedTask);
  }
  
  // Update orders only if they changed to minimize calls
  statusTasks.forEach(function(t, idx) {
    var newOrder = idx + 1;
    if (t.order !== newOrder) {
      sheet.getRange(t.row, orderColIndex + 1).setValue(newOrder);
    }
  });
  
  return { success: true };
}

/**
 * Updates any field for a task
 */
function updateTaskField(taskId, fieldName, newValue) {
  var row = findRowByTaskId(taskId);
  if (row === -1) throw new Error('Task not found');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colIndex = headers.findIndex(function(h) { return String(h).trim().toLowerCase() === fieldName.toLowerCase(); });
  if (colIndex === -1) throw new Error('Column not found');
  sheet.getRange(row, colIndex + 1).setValue(newValue);
  return { success: true };
}

/**
 * Updates a field with a hyperlink
 */
function updateTaskFieldWithLink(taskId, fieldName, displayText, url) {
  var row = findRowByTaskId(taskId);
  if (row === -1) throw new Error('Task not found');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colIndex = headers.findIndex(function(h) { return String(h).trim().toLowerCase() === fieldName.toLowerCase(); });
  if (colIndex === -1) throw new Error('Column not found');
  
  var cell = sheet.getRange(row, colIndex + 1);
  if (url && displayText) {
    var richText = SpreadsheetApp.newRichTextValue().setText(displayText).setLinkUrl(url).build();
    cell.setRichTextValue(richText);
  } else {
    cell.setValue(displayText || '');
  }
  return { success: true };
}

/**
 * Adds a new task with any fields, including link fields
 * Optimized to perform all updates in minimum calls
 */
function addTask(taskData, linkFields) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  ensureTaskIdColumn();
  ensureOrderColumn();
  
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerLower = headers.map(function(h) { return String(h).trim().toLowerCase(); });
  
  var idColIndex = headerLower.findIndex(function(h) {
    return h === 'task id' || h === 'taskid' || h === 'id';
  });
  
  var orderColIndex = headerLower.indexOf('order');
  var statusColIndex = headerLower.indexOf('status');
  
  var newTaskId = generateTaskId();
  var newOrder = 1;
  
  if (statusColIndex !== -1 && orderColIndex !== -1 && taskData['Status']) {
    var data = sheet.getDataRange().getValues();
    var maxOrder = 0;
    var newStatus = String(taskData['Status']).trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][statusColIndex]).trim() === newStatus) {
        maxOrder = Math.max(maxOrder, Number(data[i][orderColIndex]) || 0);
      }
    }
    newOrder = maxOrder + 1;
  }
  
  var richTextUpdates = [];
  var newRow = headers.map(function(header, idx) {
    var key = String(header).trim();
    if (idx === idColIndex) return newTaskId;
    if (idx === orderColIndex) return newOrder;
    
    // Handle link fields
    if (linkFields && linkFields[key]) {
      var link = linkFields[key];
      if (link.url && link.text) {
        var richText = SpreadsheetApp.newRichTextValue().setText(link.text).setLinkUrl(link.url).build();
        richTextUpdates.push({ col: idx + 1, value: richText });
        return link.text;
      }
    }
    
    return taskData[key] !== undefined ? taskData[key] : '';
  });
  
  sheet.appendRow(newRow);
  var row = sheet.getLastRow();
  
  // Apply Rich Text updates if any
  richTextUpdates.forEach(function(update) {
    sheet.getRange(row, update.col).setRichTextValue(update.value);
  });
  
  return { success: true, taskId: newTaskId };
}

/**
 * Updates an entire task, including any link fields
 * Optimized to perform updates in bulk
 * @param {string} taskId - The unique task ID
 * @param {Object} taskData - Object with field names as keys
 * @param {Object} linkFields - Optional: Object mapping field names to {text, url}
 */
function updateTask(taskId, taskData, linkFields) {
  var row = findRowByTaskId(taskId);
  if (row === -1) throw new Error('Task not found with ID: ' + taskId);
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // Find Task ID column to skip it
  var idColIndex = headers.findIndex(function(h) {
    var lower = String(h).trim().toLowerCase();
    return lower === 'task id' || lower === 'taskid' || lower === 'id';
  });
  
  // Prepare a single row of values for setValues()
  var currentValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  var newValues = [currentValues.slice()];
  var richTextUpdates = [];
  
  headers.forEach(function(header, idx) {
    if (idx === idColIndex) return;
    
    var key = String(header).trim();
    
    // Check if this is a link field that needs Rich Text
    if (linkFields && linkFields[key]) {
      var link = linkFields[key];
      if (link.url && link.text) {
        var richText = SpreadsheetApp.newRichTextValue()
          .setText(link.text)
          .setLinkUrl(link.url)
          .build();
        richTextUpdates.push({ col: idx + 1, value: richText });
        newValues[0][idx] = link.text; // Update display value for the setValues call
      }
    } else if (taskData[key] !== undefined) {
      newValues[0][idx] = taskData[key];
    }
  });
  
  // 1. Update all plain values in one call
  sheet.getRange(row, 1, 1, lastCol).setValues(newValues);
  
  // 2. Update Rich Text links
  richTextUpdates.forEach(function(update) {
    sheet.getRange(row, update.col).setRichTextValue(update.value);
  });
  
  return { success: true };
}

/**
 * Deletes a task by its unique ID
 * @param {string} taskId - The unique task ID
 */
function deleteTask(taskId) {
  var row = findRowByTaskId(taskId);
  if (row === -1) {
    throw new Error('Task not found with ID: ' + taskId);
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  sheet.deleteRow(row);
  return { success: true };
}

/**
 * Gets schema info for the frontend
 */
function getSchema() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var config = getConfig();
  
  // Create lowercase lookup map for case-insensitive matching
  var configLower = {};
  Object.keys(config).forEach(function(key) {
    configLower[key.toLowerCase()] = config[key];
  });
  
  var schema = headers.map(function(h) {
    var name = String(h).trim();
    // Case-insensitive lookup: "Work Stream" matches "work stream", etc.
    var configOptions = configLower[name.toLowerCase()] || null;
    return {
      name: name,
      hasOptions: !!configOptions,
      isStatus: name.toLowerCase() === 'status',
      options: configOptions
    };
  });
  
  return schema;
}
