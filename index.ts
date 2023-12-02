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

let runBtn = document.getElementById("run")
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
    let { Solver, Int, Distinct, /*Sum,*/ Or } = Context("main");
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
      for (let i = 0; i < 9; i++) {
        solver.add(Distinct(...z3Grid[i]));
      }
    }

    // 1-9vert
    if (constraints.includes('1-9vert')) {
      for (let i = 0; i < 9; i++) {
        solver.add(Distinct(...z3Grid.map(row => row[i])));
      }
    }

    // 1-9nonet
    if (constraints.includes('1-9nonet')) {
      for (let i = 0; i < 9; i += 3) {
        for (let j = 0; j < 9; j += 3) {
          let squares = Array.from({length: 9}, (_, k) => k).map((k) => {
            return [i + Math.floor(k / 3), j + k % 3];
          });
          solver.add(Distinct(...squares.map(([row, col]) => z3Grid[row][col])));
        }
      }
    }

    // antiking
    if (constraints.includes('antiking')) {
      let offsets = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
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

    // antiknight
    if (constraints.includes('antiknight')) {
      let offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
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

    // thermo
    savedConstraints.thermo.forEach(thermo => {
      for (let i = 0; i < thermo.length - 1; i++) {
        solver.add(z3Grid[thermo[i][1]][thermo[i][0]].lt(z3Grid[thermo[i+1][1]][thermo[i+1][0]]));
      }
    });

    // arrow
    savedConstraints.arrow.forEach(arrow => {
      // Each arrow is a list of [x,y] pairs
      // TODO
      let temp = [];
      for (let i = 1; i < arrow.length; i++) {
        temp.push(z3Grid[arrow[i][1]][arrow[i][0]]);
      }
      //solver.add(z3Grid[arrow[0][1]][arrow[0][0]].eq(Sum(...temp)));
    })

    // kropki
    savedConstraints.kropkiAdjacent.forEach(kka => {
      // Each kropki is [[x1,y1], [x2,y2]]
      solver.add(Or(
        z3Grid[kka[0][1]][kka[0][0]].sub(z3Grid[kka[1][1]][kka[1][0]]).eq(1),
        z3Grid[kka[1][1]][kka[1][0]].sub(z3Grid[kka[0][1]][kka[0][0]]).eq(1)
      ));
    })
    savedConstraints.kropkiDouble.forEach(kkd => {
      // Each kropki is [[x1,y1], [x2,y2]]
      solver.add(Or(
        z3Grid[kkd[0][1]][kkd[0][0]].mul(2).eq(z3Grid[kkd[1][1]][kkd[1][0]]),
        z3Grid[kkd[1][1]][kkd[1][0]].mul(2).eq(z3Grid[kkd[0][1]][kkd[0][0]])
      ));
    })

    // german whispers
    savedConstraints.germanWhispers.forEach(whisper => {
      // Each whisper is [x,y] array
      if (whisper.length < 2) {
        // do nothing
      } else {
        for (let i = 0; i < whisper.length; i++) {
          solver.add(z3Grid[whisper[i][1]][whisper[i][0]].neq(5));
        }
        for (let i = 0; i < whisper.length - 1; i++) {
          solver.add(Or(
            z3Grid[whisper[i][1]][whisper[i][0]].sub(z3Grid[whisper[i+1][1]][whisper[i+1][0]]).ge(5),
            z3Grid[whisper[i][1]][whisper[i][0]].sub(z3Grid[whisper[i+1][1]][whisper[i+1][0]]).le(-5)
          ));
        }
        solver.add(Or(
          z3Grid[whisper[whisper.length-1][1]][whisper[whisper.length-1][0]].sub(z3Grid[whisper[whisper.length-2][1]][whisper[whisper.length-2][0]]).ge(5),
          z3Grid[whisper[whisper.length-1][1]][whisper[whisper.length-1][0]].sub(z3Grid[whisper[whisper.length-2][1]][whisper[whisper.length-2][0]]).le(-5),          
        ));
      }
    })

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