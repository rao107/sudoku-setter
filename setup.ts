import {validateJSON, expectNumbersWithin} from "./validate";
/** Handles setting up some event listeners for elements */
export function init() {
  // Click events
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      // Add the onclick events
      document.getElementById(`i${y}${x}`)?.addEventListener('click', event => {
        let target = <HTMLInputElement>event.target;
        // Get indicies from id
        let x = parseInt(target.id[1]);
        let y = parseInt(target.id[2]);
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
    clearSavedConstraints();
    drawCanvas();
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
  drawCanvas();
}

const canvasSize = 150*3;
const tileSize = Math.floor(canvasSize/9);

export function drawCanvas() {
  let canvas = <HTMLCanvasElement>document.getElementById("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  let ctx = canvas.getContext('2d');
  
  if (ctx === null) return;
  ctx.clearRect(0,0,canvasSize,canvasSize);
  // Draw border
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 5;
  ctx.strokeRect(1,1,canvasSize-1,canvasSize-1);

  // Draw lines for nonets and tiles
  for(let i = 1; i < 9; i++) {
    ctx.beginPath();
    ctx.lineWidth = (i % 3 === 0) ? 5: 2;
    // Vertical line
    ctx.moveTo(tileSize * i, 0);
    ctx.lineTo(tileSize * i, canvasSize);
    // Horizontal line
    ctx.moveTo(0, tileSize * i);
    ctx.lineTo(canvasSize, tileSize * i);
    ctx.stroke();
  }

  savedConstraints.thermo.forEach(thermo => {
    // Draw thermos
    if(ctx === null) return;
    let [bulbx,bulby] = thermo[0];
    // Draw bulb
    circleAtTile(ctx, true, bulbx, bulby, 0.8, 'gray');
    // Draw lines
    for(let i = 0; i < thermo.length - 1; i++) {
      ctx.lineCap = "round";
      lineBetweenTiles(ctx, 
        thermo[i][0], thermo[i][1], 
        thermo[i + 1][0], thermo[i + 1][1], 
        15, 'gray');
    }
  });
  savedConstraints.arrow.forEach(arrow => {
    // Draw thermos
    if(ctx === null) return;
    const color = '#a0a0a0';
    const width = 4;
    let [arrX,arrY] = arrow[0];
    circleAtTile(ctx, false, arrX, arrY, 0.8, color, width);
    // Draw from outer radius to center of second tile
    lineBetweenTiles(ctx, 
      ...movePointInDir(arrow[0][0], arrow[0][1],arrow[1][0], arrow[1][1], 0.4), 
      arrow[1][0], arrow[1][1], 
      width, color);
    for(let i = 1; i < arrow.length - 1; i++) {
      ctx.lineCap = "round";
      lineBetweenTiles(ctx, 
        arrow[i][0], arrow[i][1], 
        arrow[i + 1][0], arrow[i + 1][1], 
        width, color
      );
    }
    // They are forced to be at least 2 elements, so this is okay
    let [secondLastX, secondLastY] = arrow[arrow.length - 2];
    let [lastX, lastY] = arrow[arrow.length - 1];
    let dx = lastX - secondLastX;
    let dy = lastY - secondLastY;
    // Angle is flipped a way we don't want so I change it
    let angle = Math.PI + Math.atan2(dy, dx);
    // Draw two small lines from end point based on angle
    ctx.lineCap = 'round';
    lineBetweenTiles(ctx,
      lastX, lastY, 
      ...movePointByAngle(lastX, lastY, angle + Math.PI/4, 0.3),
      width, color
    );
    lineBetweenTiles(ctx,
      lastX, lastY, 
      ...movePointByAngle(lastX, lastY, angle - Math.PI/4, 0.3),
      width, color
    );

  });
  savedConstraints.germanWhispers.forEach(whisper => {
    if(ctx === null) return;
    for(let i = 0; i < whisper.length - 1; i++) {
      lineBetweenTiles(ctx, 
        whisper[i][0], whisper[i][1], 
        whisper[i + 1][0], whisper[i + 1][1], 
        8, 'green');
    }
  });
  savedConstraints.kropkiDouble.forEach(kropki => {
    if(ctx === null) return;
    let [x1, y1] = kropki[0];
    let [x2, y2] = kropki[1];
    // Average two points should give where dot should go
    let nx = (x1 + x2) / 2;
    let ny = (y1 + y2) / 2;
    circleAtTile(ctx, true, nx, ny, 0.3, 'black');
  });
  savedConstraints.kropkiAdjacent.forEach(kropki => {
    if(ctx === null) return;
    let [x1, y1] = kropki[0];
    let [x2, y2] = kropki[1];
    // Average two points should give where dot should go
    let nx = (x1 + x2) / 2;
    let ny = (y1 + y2) / 2;
    // First draw white under, then black outline
    circleAtTile(ctx, true, nx, ny, 0.3, 'white');
    circleAtTile(ctx, false, nx, ny, 0.3, 'black', 2);
  });
}

/** Draws a circle at a tile with a specified radius of 0-1 percentage of a tile */
function circleAtTile(ctx:CanvasRenderingContext2D, fill:boolean, tileX:number, tileY:number, radius:number, color:string, lineWidth=5) {
  ctx.beginPath();
  ctx.arc(tileX * tileSize + tileSize/2, 
    tileY * tileSize + tileSize/2, 
    (tileSize * radius)/2, 0, Math.PI * 2);
  if(fill) {
    ctx.fillStyle = color;
    // this closes the path
    ctx.fill();
  } else {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    // this closes the path
    ctx.stroke();
  }
}

/** Draws a line between two specified tile points */
function lineBetweenTiles(ctx:CanvasRenderingContext2D, x1:number, y1:number, x2:number, y2:number, width:number, color:string) {
  ctx.beginPath();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.moveTo(x1 * tileSize + tileSize/2, y1 * tileSize + tileSize/2);
  ctx.lineTo(x2 * tileSize + tileSize/2, y2 * tileSize + tileSize/2);
  // This closes the path
  ctx.stroke();
}

/** 
 * Moves one point towards another by a static amount.
 * Used for drawing arrow lines
 */
function movePointInDir(fromX:number, fromY:number, destX:number, destY:number, dist:number):[number, number] {
  // let dx = clamp(destX - fromX, -1, 1);
  // let dy = clamp(destY - fromY, -1, 1);
  let angle = (Math.PI/2)-Math.atan2(destX - fromX, destY - fromY);
  // dx and dy = -1, 0, or 1
  return [
    fromX + Math.cos(angle) * dist,
    fromY + Math.sin(angle) * dist
  ];
}

/** Pushes a point along a angle by a distance */
function movePointByAngle(fromX:number, fromY:number, angleRad:number, dist:number):[number, number] {
  return [
    fromX + Math.cos(angleRad) * dist,
    fromY + Math.sin(angleRad) * dist
  ];
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

  // Check more complex constraints
  ["thermo", "arrow", "germanWhispers"].forEach(con => {
    // Check for constraint
    if (json[con] === undefined) {
      console.log("Did not have constraint " + con);
      return;
    }
    // Has constraint, so check format
    if (!validateJSON(json[con], [[[0,0]]])) { 
      console.warn("Invalid format for "+con);
      return;
    }
    // Check for values between 0-8
    if(!expectNumbersWithin(json[con], 0, 8)) {
      console.warn(`Indicies for ${con} must be between 0-8`);
      return;
    }
    // Make sure all points are adjacent
    if(!requireAdjacentPoints(json[con], true)) {
      console.warn(`Points for ${con} need to be adjacent`);
      return;
    }
    // Require length >= 2
    for(let i = 0; i < json[con].length; i++) {
      if(json[con][i].length < 2) {
        console.warn(`Constraints for ${con} must have at least two points`);
        return;
      }
    }
    // TS doesn't like this cause it can't be sure
    //  that the properties line up. Its fine, I'm sure
    //@ts-ignore
    savedConstraints[con] = json[con];
  });
  ["kropkiAdjacent", "kropkiDouble"].forEach(kropki => {
    // Check more complex constraints
    if (json[kropki] === undefined) {
      console.log("Did not have constraint " + kropki);
      return;
    }
    // Has constraint, so check format
    if (!validateJSON(json[kropki], [[[0,0],[0,0]]] )) { 
      console.warn("Invalid format for "+kropki);
      return;
    }       
    // Check for values between 0-8
    if(!expectNumbersWithin(json[kropki], 0, 8)) {
      console.warn(`Indicies for ${kropki} must be between 0-8`);
      return;
    }
    // Check for adjacency of values before accepting them
    if(!requireAdjacentPoints(json[kropki], false)) {
      console.warn(`Points within ${kropki} need to be adjacent`);
      return
    } 
    // TS doesn't like this cause it can't be sure
    //  that the properties line up. Its fine, I'm sure
    //@ts-ignore
    savedConstraints[kropki] = json[kropki];
  });
  console.log(savedConstraints);
  // Update visuals
  drawCanvas();
}

/** 
 * Tells if all points within the array are adjacent to the next element 
 *  Can specify if diagonals are allowed
 */
function requireAdjacentPoints(input:[number,number][][], allowDiagonals:boolean): boolean {
  for(let s = 0; s < input.length; s++) {
    let set = input[s];
    for(let i = 0; i < set.length - 1; i++) {
      let [x1, y1] = set[i];
      let [x2, y2] = set[i + 1];
      if(!areAdjacent(x1, y1, x2, y2, allowDiagonals))
        return false;
    }
  }
  return true;
}

/**
 * Tells if two points are adjacent, with the option 
 *  of allowing diagonals to be accepted 
 */
function areAdjacent(x1:number, y1:number, x2:number,y2:number, allowDiagonals:boolean):boolean {
  if (x1 === x2) {
    // In same column
    // Deny same point
    if(y1 === y2) return false;
    // Allow only ones that are one spot over
    return (y1 === y2 - 1 || y1 === y2 + 1);
  } else if(y1 === y2) {
    // Same row
    return (x1 === x2 - 1 || x1 === x2 + 1);
  } else {
    if(allowDiagonals) {
      // Accept if both are off by 1
      if (Math.abs(x1 - x2) !== 1) return false;
      if (Math.abs(y1 - y2) !== 1) return false;
      return true;
    } else {
      return false;
    }
  }
}