import * as z3 from 'z3-solver';
import { 
  inputGrid, 
  getConstraints, 
  init, 
  showLoadingScreen, 
  hideLoadingScreen,
  savedConstraints,
  importFromFile,
} from './setup';

declare global {
  interface Window { z3Promise: ReturnType<typeof z3.init>; }
}

/** Gets the numeric values from the HTMLInputs */
function getGrid(): number[][] {
  const grid: number[][] = Array.from(Array(9), () => new Array(9));
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      grid[i][j] = parseInt(inputGrid[i][j].value);
    }
  }
  return grid;
}

window.z3Promise = z3.init();
// so other scripts can Z3 - they just need to `await window.z3Promise`
// this script must be before those scripts on the page

/**
 * Numbers in a row must not be the same
 */
function addRowConstraint(solver : z3.Solver<"main">, z3Grid : z3.Arith<"main">[][], Distinct : (...args: z3.CoercibleToExpr<"main">[]) => z3.Bool<"main">) {
  for (let i = 0; i < 9; i++) {
    solver.add(Distinct(...z3Grid[i]));
  }
}

/**
 * Numbers in a column must not be the same
 */
function addColConstraint(solver : z3.Solver<"main">, z3Grid : z3.Arith<"main">[][], Distinct : (...args: z3.CoercibleToExpr<"main">[]) => z3.Bool<"main">) {
  for (let i = 0; i < 9; i++) {
    solver.add(Distinct(...z3Grid.map(row => row[i])));
  }
}

/**
 * Numbers in a nonet must not be the same
 */
function addNonetConstraint(solver : z3.Solver<"main">, z3Grid : z3.Arith<"main">[][], Distinct : (...args: z3.CoercibleToExpr<"main">[]) => z3.Bool<"main">) {
  for (let i = 0; i < 9; i += 3) {
    for (let j = 0; j < 9; j += 3) {
      let squares = Array.from({length: 9}, (_, k) => k).map((k) => {
        return [i + Math.floor(k / 3), j + k % 3];
      });
      solver.add(Distinct(...squares.map(([row, col]) => z3Grid[row][col])));
    }
  }
}

/**
 * All squares must not be equal to the offset squares globally
 */
function addOffsetConstraint(solver : z3.Solver<"main">, z3Grid : z3.Arith<"main">[][], offsets : [number, number][]) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      let squares =
        offsets
        .map(([i_0, j_0]) => [i + i_0, j + j_0])
        .filter(([i_0, j_0]) => (0 <= i_0) && (i_0 < 9) && (0 <= j_0) && (j_0 < 9));
      squares.forEach(([row, col]) => {
        solver.add(z3Grid[i][j].neq(z3Grid[row][col]));
      });
    }
  }
}

/**
 * Given squares must strictly increase
 */
function addIncreasingConstraint(solver : z3.Solver<"main">, z3Grid : z3.Arith<"main">[][], squares : [number, number][]) {
  for (let i = 0; i < squares.length - 1; i++) {
    solver.add(z3Grid[squares[i][1]][squares[i][0]].lt(z3Grid[squares[i+1][1]][squares[i+1][0]]));
  }
}

/**
 * Given pair must be exactly a given difference from each other
 */
function addExactDifferenceConstraint(solver : z3.Solver<"main">, z3Grid : z3.Arith<"main">[][], pair : [number, number][], diff : number, Or : (...args: (boolean | z3.Bool<"main">)[]) => z3.Bool<"main">) {
  if (pair.length == 2) {
    // Each pair is [[x1,y1], [x2,y2]]
    solver.add(Or(
      z3Grid[pair[0][1]][pair[0][0]].sub(z3Grid[pair[1][1]][pair[1][0]]).eq(diff),
      z3Grid[pair[1][1]][pair[1][0]].sub(z3Grid[pair[0][1]][pair[0][0]]).eq(diff)
    ));
  }
}

/**
 * Given pair must be at least a given difference from each other
 */
function addAtLeastDifferenceConstraint(solver : z3.Solver<"main">, z3Grid : z3.Arith<"main">[][], pair : [number, number][], diff : number, Or : (...args: (boolean | z3.Bool<"main">)[]) => z3.Bool<"main">) {
  if (pair.length == 2) {
    solver.add(Or(
      z3Grid[pair[0][1]][pair[0][0]].sub(z3Grid[pair[1][1]][pair[1][0]]).ge(diff),
      z3Grid[pair[0][1]][pair[0][0]].sub(z3Grid[pair[1][1]][pair[1][0]]).le(-diff)
    ));
  }
}

/**
 * Given pair must be at most a given difference from each other
 */
 function addAtMostDifferenceConstraint(solver : z3.Solver<"main">, z3Grid : z3.Arith<"main">[][], pair : [number, number][], diff : number, Or : (...args: (boolean | z3.Bool<"main">)[]) => z3.Bool<"main">) {
  if (pair.length == 2) {
    solver.add(Or(
      z3Grid[pair[0][1]][pair[0][0]].sub(z3Grid[pair[1][1]][pair[1][0]]).le(diff),
      z3Grid[pair[0][1]][pair[0][0]].sub(z3Grid[pair[1][1]][pair[1][0]]).ge(-diff)
    ));
  }
}

/**
 * Given Kropki pairs must have one square be a double of another
 */
function addKropkiDoubleConstraint(solver : z3.Solver<"main">, z3Grid : z3.Arith<"main">[][], kkd : [number, number][], Or : (...args: (boolean | z3.Bool<"main">)[]) => z3.Bool<"main">) {
  // Each kropki is [[x1,y1], [x2,y2]]
  let fst = z3Grid[kkd[0][1]][kkd[0][0]];
  let snd = z3Grid[kkd[1][1]][kkd[1][0]];
  solver.add(Or(
    fst.eq(1).and(snd.eq(2)),
    fst.eq(2).and(snd.eq(1)),
    fst.eq(2).and(snd.eq(4)),
    fst.eq(3).and(snd.eq(6)),
    fst.eq(4).and(snd.eq(2)),
    fst.eq(4).and(snd.eq(8)),
    fst.eq(6).and(snd.eq(3)),
    fst.eq(8).and(snd.eq(4))
  ));
}

let runBtn = document.getElementById("run");
if (runBtn === undefined || runBtn === null) {
  console.error("no run btn");
} else {
  runBtn.addEventListener("click", async () => {
    showLoadingScreen();
    let constraints = getConstraints();
    console.log(constraints);

    const sudokuGrid: number[][] = getGrid();
    console.log(sudokuGrid);

    let { Context } = await window.z3Promise;
    let { Solver, Int, Distinct, Or, If, And } = Context("main");
    let solver = new Solver();

    let z3Grid: z3.Arith<"main">[][] = Array.from(Array(9), () => new Array(9));
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        z3Grid[i][j] = Int.const(`x_${i}${j}`);
        if (1 <= sudokuGrid[i][j] && sudokuGrid[i][j] <= 9) {
          solver.add(z3Grid[i][j].eq(sudokuGrid[i][j]));
        } else {
          solver.add(z3Grid[i][j].ge(1).and(z3Grid[i][j].le(9)));
        }
      }
    }
    // 1-9horiz
    if (constraints.includes('1-9horiz')) {
      addRowConstraint(solver, z3Grid, Distinct);
    }
    // 1-9vert
    if (constraints.includes('1-9vert')) {
      addColConstraint(solver, z3Grid, Distinct);
    }
    // 1-9nonet
    if (constraints.includes('1-9nonet')) {
      addNonetConstraint(solver, z3Grid, Distinct); 
    }
    // antiking
    if (constraints.includes('antiking')) {
      addOffsetConstraint(solver, z3Grid, [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]);
    }
    // antiknight
    if (constraints.includes('antiknight')) {
      addOffsetConstraint(solver, z3Grid, [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]);
    }
    // thermo
    savedConstraints.thermo.forEach(thermo => {
      addIncreasingConstraint(solver, z3Grid, thermo);
    });
    // arrow
    savedConstraints.arrow.forEach(arrow => {
      // Each arrow is a list of [x,y] pairs
      // TODO
      //let temp = [];
      //for (let i = 1; i < arrow.length; i++) {
      //  temp.push(z3Grid[arrow[i][1]][arrow[i][0]]);
      //}
      //solver.add(z3Grid[arrow[0][1]][arrow[0][0]].eq(Sum(...temp)));

//      let sum = z3Grid[arrow[1][1]][arrow[1][0]];
      //for (let i = 1; i < arrow.length; i++) {
      //  sum.add(z3Grid[arrow[i][1]][arrow[i][0]]);
      //}
      //solver.add(z3Grid[arrow[0][1]][arrow[0][0]].eq(z3Grid[arrow[1][1]][arrow[1][0]].add(z3Grid[arrow[2][1]][arrow[2][0]]).add(z3Grid[arrow[3][1]][arrow[3][0]])));
    });
    // kropki
    savedConstraints.kropkiAdjacent.forEach(kka => {
      addExactDifferenceConstraint(solver, z3Grid, kka, 1, Or);
    });
    savedConstraints.kropkiDouble.forEach(kkd => {
      addKropkiDoubleConstraint(solver, z3Grid, kkd, Or);
    });
    // german whispers
    savedConstraints.germanWhispers.forEach(whisper => {
      // Each whisper is [x,y] array
      for (let i = 0; i < whisper.length - 1; i++) {
        let pair = [whisper[i], whisper[i + 1]];
        addAtLeastDifferenceConstraint(solver, z3Grid, pair, 5, Or);
      }
    });
    if (await solver.check() === "sat") {
      hideLoadingScreen();
      // Was SAT so tell the output
      const resultGrid = Array.from(Array(9), () => new Array(9));
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          // i hate this parseInt weirdness but idk how to get an integer directly
          resultGrid[i][j] = parseInt(solver.model().get(z3Grid[i][j]).toString());
        }
      }
      console.log(gridToString(resultGrid));
      alert(`One Solution is\n${gridToString(resultGrid)}`);

    } else {
      hideLoadingScreen();
      alert("Was unsat or unknown");
    }
  });
}

let numSolBtn = document.getElementById("num-sol");
if (numSolBtn === undefined || numSolBtn === null) {
  console.error("no num-sol btn");
} else {
  numSolBtn.addEventListener("click", async () => {
    showLoadingScreen();
    console.log("test");
    hideLoadingScreen();
  });
}

init();

/** Puts together a 2d array of numbers into a more paletable sudo grid-like string */
function gridToString(grid:number[][]) {
  return grid.map(e=>{
    // Get each row into xxx|xxx|xxx
    return e.reduce((acc, cur, idx) => {
      return acc + `${cur}${(idx === 2 || idx === 5) ? "|":""}`;
    }, "")
  }).reduce((acc, cur, idx) =>{ 
    // Get cols into "c\nc\nc\n----" format
    return acc + `\n${cur}${(idx === 2 || idx === 5) ? "\n-----------":""}`;
  }, "");
}

type SaveObject ={
  given:number[][],
  thermo:[number,number][][],
  arrow:[number,number][][],
  kropkiDouble:[[number,number],[number,number]][]
  kropkiAdjacent:[[number,number],[number,number]][]
  germanWhispers:[number,number][][],
  "1-9horiz":boolean | undefined,
  "1-9vert":boolean | undefined,
  "1-9nonet":boolean | undefined,
  antiknight: boolean | undefined,
  antiking: boolean | undefined
}

/** Creates an object for use in the `downloadObjectAsJSON()` function */
function buildSaveObject():SaveObject {
  let given = getGrid()
    .map(row => row.map(c => c ? c : 0));
  let bConstraints = getConstraints();
  let out: {[name:string]:any} = { given, ...savedConstraints };
  // Gather boolean constraints
  bConstraints.forEach(con => {
    out[con] = true;
  });
  // TS isn't sure that the values are set
  //@ts-ignore
  return out;
}

/** Can be used to allow saving  */
function downloadObjectAsJson(exportObj:object, exportName:string){
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
  var downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href",     dataStr);
  downloadAnchorNode.setAttribute("download", exportName + ".json");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

document.getElementById("save")?.addEventListener('click', event => {
  downloadObjectAsJson(buildSaveObject(), 'sudoku-export');
})

function saveToLocalStorage() {
  localStorage.setItem("saved-sudoku",
    JSON.stringify(buildSaveObject()));
}

function loadFromLocalStorage() {
  let item = localStorage.getItem('saved-sudoku');
  if(item === null) {
    console.log("Had no localStorage data");
    return;
  }
  try {
    let json: SaveObject = JSON.parse(item)
    importFromFile(json);
    console.log("Loaded from localStorage")
  } catch (e) {
    // Data was bad, so just get rid of it
    localStorage.removeItem("saved-sudoku");
    console.error("Could not load JSON from localStorage")
  }
}

addEventListener('beforeunload', event => {
  // For some reason, this is very hot or miss
  console.log("save");
  saveToLocalStorage();
  // Save current state
});

addEventListener('keypress', event => {
  if (event.key === "s") {
    saveToLocalStorage();
  }
})


addEventListener('load', event => {
  console.log("Load");
  loadFromLocalStorage();
})

function Sum(arg0: z3.Arith<"main">): z3.CoercibleToExpr<"main"> {
  throw new Error('Function not implemented.');
}
