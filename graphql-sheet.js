
class Graphql {
  /**
   * create a database with a spreadsheet
   * @param {id} the id of the spreadsheet which you have full access
   */
  constructor(id) {
    this.id = id
    try {
      this.db = SpreadsheetApp.openById(id)
      this.sheets = this.db.getSheets()
      this.names = this.sheets.map(sheet => sheet.getName())
    } catch (e) {
      throw new Error(`${e.message}`)
    }

    this.variablePattern =
      this.REGX = {
        VARIABLE: {
          pattern: /^\$[a-zA-Z\d_-]+\s*:\s*[a-zA-Z\d_-]+!?$/,
          errorMessage: "Variable partten ${key}:{type}!, key and type can contain letters, numbers, underscore, and dash.",
        },
        FILTER: {
          pattern: /^[a-zA-Z\d_-]+\s*:\s*\$[a-zA-Z\d_-]+$/,
          errorMessage: "Table filter pattern {filterKey}:${variableKey}, both keys can contain letters, numbers, underscore, and dash.",
        }
      }
  }




  /**
   * parse the entry line of the query
   * return an object with query type[query, mutation], query name[optional], and variables[optional]
   */
  parseQueryEntry(entryLine) {
    const queryEntry = {
      type: null,
      name: null,
      variables: [],
    }
    entryLine = entryLine.trim()

    // handle query type
    if (entryLine.startsWith("query")) {
      queryEntry.type = "query"
    } else if (entryLine.startsWith("mutation")) {
      queryEntry.type = "mutation"
    } else {
      throw new Error(`Valid query can only start with "query" or "mutation"`)
    }

    // handle query name
    let names = entryLine.split("(")[0].trim().split(" ").slice(1).filter(v => v !== "")
    if (names.length > 1) throw new Error(`Invalid query name ${names.join(" ")}`)
    if (names.length === 1) queryEntry.name = names[0]



    // handle variables
    if (entryLine.indexOf("(") === -1 || entryLine.indexOf(")") === -1) return queryEntry
      let variables = entryLine.split("(")[1].split(")")[0].split(",")
      queryEntry.variables = variables.map(v => {
        v = v.trim()
        if (v !== "") {
          if (!this.REGX.VARIABLE.pattern.test(v)) throw new Error(this.REGX.VARIABLE.errorMessage)
          let required = false
          let [variable, type] = v.split(/\s*:\s*/)
          if (type.endsWith("!")) {
            required = true
            type = type.slice(0, -1)
          }
          return { variable, type, required }
        }
      })

    return queryEntry
  }

  parseTableName(tableNameLine) {
    const tableName = {
      name: null,
      filters: [],
    }
    const [leftName, rightName] = tableNameLine.trim().split("(")
    tableName.name = leftName.trim()
    if (!rightName) return tableName

    const filters = rightName.trim().replace(")", "").split(",")
    filters.forEach(v => {
      if (!this.REGX.FILTER.pattern.test(v)) throw new Error(`${this.REGX.FILTER.errorMessage}; error value: ${v}`)
      const [key, value] = v.split(/\s*:\s*/)
      tableName.filters.push({
        key,
        value
      })
    })
    return tableName
  }

  parseQuery(query) {
    const lines = query.trim()
      .split('\n')
      .map(v => v.replace(/[\t]+/g, ""))
      .filter(v => v !== "")

    let queryEntry
    let entryLine
    let entryTableLine
    let entryTableName
    const queryFields = {}
    const queryFilters = {}
    let tableStacks = []

    lines.forEach(line => {
      line = line.trim()
      if (line.slice(-1) === "{") {
        line = line.slice(0, -1)
        if (!entryLine) {
          entryLine = line
          queryEntry = this.parseQueryEntry(entryLine)
        } else {
          const { name, filters } = this.parseTableName(line)
          if (!entryTableLine) {
            entryTableLine = line
            entryTableName = name
          }
          queryFilters[name] = filters
          if (queryFields[tableStacks.slice(-1)]) queryFields[tableStacks.slice(-1)].push(name)
          tableStacks.push(name)
          if (!queryFields[name]) queryFields[name] = []
        }
      } else if (line === "}") {
        tableStacks.pop()
      } else if (line !== "") {
        queryFields[tableStacks.slice(-1)].push(line)
      }
    })
    return { queryEntry, entryTableName, queryFields, queryFilters }
  }

  getRelatedItems(name, ids, queryFields, queryFilters) {
    
    const fields = queryFields[name]
    const isIdInFields = fields.includes("id")
    if (!isIdInFields) queryFields[name].push("id")
    const items = this.getAllItems(name, queryFields, queryFilters)
    const relatedItems = []
    items.forEach(item => {
      if( ids.includes(`${item.id}`)) {
        if (!isIdInFields) delete item.id
        relatedItems.push(item)
      }
    })
    return relatedItems
  }

  isVaidItem(item, filters){
    const results = filters.map(({key, value}) => item[key] == value)
    return !results.includes(false)
  }

  /**
   * get all items from a sheet with the given name
   * @param {string} name the name of the sheet 
   * @return all items in the sheet
   */
  getAllItems(name, queryFields, queryFilters) {
    const fields = queryFields[name]
    const filters = queryFilters[name]
    const ws = this.db.getSheetByName(name)
    if (!ws) throw new Error(`Sheet "${name}" was not found in the spreadsheet.`)
    let [keys, ...values] = ws.getDataRange().getValues()
    keys = keys.map(key => key.trim())
    const items = []
    values.forEach(rowValues => {
      const item = {}
      keys.forEach((key, index) => {
        if (fields.includes(key)) {
          const value = rowValues[index]
          if (key !== "") {
            if (this.names.includes(key)) {
              if (value == "") {
                item[key] = []
              } else {
                const ids = value.trim().split(",")
                item[key] = this.getRelatedItems(key, ids, queryFields, queryFilters)
              }
            } else {
              item[key] = value
            }
          }
        }
      })
      if (this.isVaidItem(item, filters)) items.push(item)
    })
    return items
  }


  updateFiltersWithVariables(queryFilters, variables){
    Object.keys(queryFilters).forEach(key => {
      const tableFilters = queryFilters[key]
      tableFilters.forEach((filter, i) => {
        if (variables[filter.key] !== undefined) queryFilters[key][i].value = variables[filter.key]
      })
    })
  }

  query(query, variables) {
    const { queryEntry, entryTableName, queryFields, queryFilters } = this.parseQuery(query)
    if (queryEntry.type !== "query") throw `${queryEntry.type} can't be used in the query request.`
    this.updateFiltersWithVariables(queryFilters, variables)
    return this.getAllItems(entryTableName, queryFields, queryFilters)
  }

  mutate(query, variable) {
    const { queryEntry, entryTableName, queryFields, queryFilters } = this.parseQuery(query)
    if (queryEntry.type !== "mutation") throw `${queryEntry.type} can't be used in the mutation request.`
    return console.info("function is not ready yet.")
  }
}

/**
 * Create a database with the id of a spreadsheet which you have full access
 *
 * @param {string} id the id of the spreadsheet
 * @return {GraphDatabase} the GraphDatabase object
 */
function create(id) {
  return new Graphql(id)
}

