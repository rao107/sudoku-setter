import * as z3 from 'z3-solver';
import setup from './setup'
declare global {
  interface Window { z3Promise: ReturnType<typeof z3.init>; }
}

const inputGrid: HTMLInputElement[][] = Array.from(Array(9), () => new Array(9));
for (let i = 0; i < 9; i++) {
  for (let j = 0; j < 9; j++) {
    inputGrid[i][j] = <HTMLInputElement>document.getElementById(`i${i}${j}`);
  }
}

function getGrid(): number[][] {
  const grid: number[][] = Array.from(Array(9), () => new Array(9));
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      grid[i][j] = parseInt(inputGrid[i][j].value);
    }
  }
  return grid;
}

// Grabs the constraints div and gets the id's of all checked children inputs 
function getConstraints():string[]{
  let out: string[] = [];
  document.getElementById("constraints")
    ?.querySelectorAll("input")
    ?.forEach(child=>{
      if (child.checked) out.push(child.id);
    })
  setup()

  return out;
}

window.z3Promise = z3.init();
// so other scripts can Z3 - they just need to `await window.z3Promise`
// this script must be before those scripts on the page

let runBtn = document.getElementById("run")
if (runBtn === undefined || runBtn === null) {
  console.error("no run btn");
} else {
  runBtn.addEventListener("click", async () => {
    let constraints = getConstraints();
    console.log(constraints);

    const sudokuGrid: number[][] = getGrid();
    console.log(sudokuGrid);

    let { Context } = await window.z3Promise;
    let { Solver, Int, Distinct } = Context("main");
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
        solver.add(Distinct(...z3Grid.map(row => row[i])))
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

    console.log(await solver.check());
    
    const resultGrid = Array.from(Array(9), () => new Array(9));
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        // i hate this parseInt weirdness but idk how to get an integer directly
        resultGrid[i][j] = parseInt(solver.model().get(z3Grid[i][j]).toString());
      }
    }
    console.log(resultGrid);
  });
}
