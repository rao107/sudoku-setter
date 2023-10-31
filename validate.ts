

/** Compares an object against a schema and tells if the object matches */
export function validateJSON(val:any, schema:any):boolean {
  if(Array.isArray(schema)) {
    if(!Array.isArray(val)) return false;
    // If schema len == 1 then assume any length of same type
    if(schema.length === 1) {
      // Match each element to be equal to this
      let key = schema[0];
      for(let i = 0; i < val.length; i++) {
        if(!validateJSON(val[i], key)) {
          return false;
        }
      }
    } else {
      // Match each element individually. Can have different types
      if(val.length !== schema.length) {
        return false;
      }
      for(let i = 0; i < val.length; i++) {
        if(!validateJSON(val[i], schema[i])) {
          return false;
        }
      }
      return true;
    }
  } else {
    if (typeof val !== typeof schema) return false;
    if (typeof schema === "object") {
      // Match key values
      //  val can have more than schema
      for(let key in schema) {
        // Make sure key exists
        if(val[key] === undefined) return false;
        if(!validateJSON(val[key], schema[key])) {
          return false;
        }
      }
      return true;
    } else {
      // If it is a primitive type, then we don't compare
      //  values, we just needed them to have the same type
      return true;
    }
  }
  return true;
}

/** Traverses recursively and expects any number inputs to be within a range inclusive */
export function expectNumbersWithin(json:any, min:number, max:number):boolean{
  if(Array.isArray(json)) {
    for(let i = 0; i < json.length; i++) {
      if(!expectNumbersWithin(json[i], min, max)) {
        return false;
      }
    }
  } else if (typeof json === "object") {
    for(let key in json) {
      if(!expectNumbersWithin(json[key], min, max)) {
        return false;
      }
    }
  } else if(typeof json === "number") {
    return json >= min && json <= max;  
  }
  return true;
}