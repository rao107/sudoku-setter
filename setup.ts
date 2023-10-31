import {validateJSON, expectNumbersWithin} from "./validate";
/** Handles setting up some event listeners for elements */
export function init() {
  // Click events
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      // Add the onclick events
      document.getElementById(`i${y}${x}`)?.addEventListener('click', event => {
        let target = <HTMLInputElement>event.target;
        console.log(`Clicked ${x},${y}`);
      });
    }
  }
  // Clear grid button
  document.getElementById("clear-grid")?.addEventListener('click', event => {
    if(!confirm("Are you sure you want to clear the grid?"))
      return;
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        inputGrid[y][x].value = "";
      }
    }
  })
  // File input
  document.getElementById("import")?.addEventListener('change', event => {
    let files = (<HTMLInputElement>event.target).files;
    if (files === null) {
      return;
    }
    let file = files[0];
    file.text().then(contents => {
      let json = undefined;
      try {
        json = JSON.parse(contents);
      } catch(e) {
        console.error("Could not parse inputted JSON file");
        return;
      }
      importFromFile(json);
    })
  })
  // Toggling controls
  let controls = Array.from(document.getElementsByClassName("controls"));
  Array.from(document.getElementsByClassName("select-controls")).forEach(control => {
    control.addEventListener('click', event => {
      // Hide all other controls
      controls.forEach(c => (<HTMLElement>c).hidden = true);
      // Show current element. Done like this to avoid closures
      let elem = <HTMLButtonElement>event.target;
      let input = elem.id.substring(elem.id.indexOf('-') + 1);
      console.log(input);
      // Show element that we want
      let controlElem = document.getElementById(`${input}-controls`);
      if (controlElem === null) return;
      controlElem.hidden = false;
      // Stop inputs from functioning
      lockAllInputs();
    })
  })

}

/** 
 * Stops inputs from acting like inputs. 
 * It will be useful for selecting tiles for placing constraints 
 */
export function lockAllInputs() {
  inputGrid.forEach(c=>c.forEach(e=>e.readOnly = true));
}
/** Allows inputs to be inserted into again */
export function unlockAllInputs() {
  inputGrid.forEach(c=>c.forEach(e=>e.readOnly = false));
}
/**Disables inputs while waiting for Z3 to return */
export function showLoadingScreen() {
  let loading = document.getElementById("loading");
  if (loading === null) return;
  loading.style.display = 'flex';
}
/**Re-enables inputs after Z3 returns */
export function hideLoadingScreen() {
  let loading = document.getElementById("loading");
  if (loading === null) return
  loading.style.display = 'none';
}

/** Used for tracking for placing constraints */
export let lastClicked:HTMLInputElement | null = null

/** Used for tracking the state ofthe currently placing constraint */
let currentConstraint: [number, number][] = [];

/** Tracks constraints that have saved memory */
export let savedConstraints:{
  thermo:[number,number][][],
  arrow:[number,number][][],
  kropkiAdjacent:[number,number][][],
  kropkiDouble:[number,number][][],
  germanWhispers:[number,number][][]
} = {
  thermo:[],
  arrow:[],
  kropkiAdjacent:[],
  kropkiDouble:[],
  germanWhispers:[]
}

export function clearSavedConstraints(){
  savedConstraints.thermo = [];
  savedConstraints.arrow = [];
  savedConstraints.kropkiAdjacent = [];
  savedConstraints.kropkiDouble = [];
  savedConstraints.germanWhispers = [];
}
// This will include the event listeners for highlighting and such

/** Changes the color of all "seen" tiles from the currently clicked on one */
function highlightSeen(row:number, col:number) {
  // TODO: Actually implement this
  // Un highlight anything that currently is 
  // Highlight tiles seen depending on rules
}
/** Holds the HTML input elements to avoid re-querying for the elements */
export const inputGrid: HTMLInputElement[][] = Array.from(Array(9), () => new Array(9));
for (let i = 0; i < 9; i++) {
  for (let j = 0; j < 9; j++) {
    inputGrid[i][j] = <HTMLInputElement>document.getElementById(`i${i}${j}`);
  }
}

/** 
 * Grabs the constraints div and gets the id's 
 * of all checked children inputs 
 */
export function getConstraints():string[]{
  let out: string[] = [];
  document.getElementById("constraints")
    ?.querySelectorAll("input")
    ?.forEach(child=>{
      if (child.checked) out.push(child.id);
    });
  return out;
}

function importFromFile(json:any) {
  // Validate object
  clearSavedConstraints();
  console.log(json);
  // These are the only required parts
  // Could format this better, but it gets the point across
  if(validateJSON(json["given"], [
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0]]))
  {
    // Format fits, so check values
    if(!expectNumbersWithin(json.given, 0,9)) {
      console.error("Values in 'given' field need to be between 0-9");
      return;
    }
  } else {
    console.error("File needs a 'given' propert that is "+
      "a 2d array length 9x9 of numbers between 0-9")
    return
  }
  // Set input values
  for(let row = 0; row < 9; row++) {
    for(let col = 0; col < 9; col++) {
      inputGrid[row][col].value = (json.given[row][col] === 0) ? "" : json.given[row][col];
    }
  }
  // Check boolean based constraints
  ["1-9vert", "1-9horiz", "1-9nonet", "antiknight", "antiking"].forEach(con => {
    let elem = <HTMLInputElement>document.getElementById(con);
    if(elem === null) return;
    if(json[con] !== undefined && typeof json[con] !== 'boolean') {
      console.warn("Invalid type for constraint "+con);
    }
    elem.checked = (json[con] !== undefined && json[con] === true);
  });

  // Lots of annoying JSON data validation below
  //  It was not fun to write, but should do the job

  ["thermo", "arrow", "germanWhispers"].forEach(con => {
    // Check more complex constraints
    if (json[con] !== undefined) {
      // Has constraint, so check format
      if (validateJSON(json[con], [[[0,0]]])) {        
        // Check for values between 0-8
        if(!expectNumbersWithin(json[con], 0, 8)) {
          console.warn(`Indicies for ${con} must be between 0-8`);
        } else {
          // TODO: Check for adjacency of values before accepting them

          // TS doesn't like this cause it can't be sure
          //  that the properties line up. Its fine, I'm sure
          //@ts-ignore
          savedConstraints[con] = json[con];
        }
      } else {
        console.warn("Invalid format for "+con);
      }
    } else {
      console.log("Did not have constraint " + con);
    }
  });
  ["kropkiAdjacent", "kropkiDouble"].forEach(kropki => {
    // Check more complex constraints
    if (json[kropki] !== undefined) {
      // Has constraint, so check format
      if (validateJSON(json[kropki], [[[0,0],[0,0]]] )) {        
        // Check for values between 0-8
        if(!expectNumbersWithin(json[kropki], 0, 8)) {
          console.warn(`Indicies for ${kropki} must be between 0-8`);
        } else {
          // TODO: Check for adjacency of values before accepting them

          // TS doesn't like this cause it can't be sure
          //  that the properties line up. Its fine, I'm sure
          //@ts-ignore
          savedConstraints[kropki] = json[kropki];
        }
      } else {
        console.warn("Invalid format for "+kropki);
      }
    } else {
      console.log("Did not have constraint " + kropki);
    }
  });
  console.log(savedConstraints);
}