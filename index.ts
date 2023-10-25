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
    console.log(getConstraints());

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
    for (let i = 0; i < 9; i++) {
      solver.add(Distinct(...z3Grid[i]));
    }

    // 1-9vert
    for (let i = 0; i < 9; i++) {
      solver.add(Distinct(...z3Grid.map(row => row[i])))
    }

    // 1-9nonet
    // you could also probably use distinct here too but idk
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        for (let k = j + 1; k < 9; k++) {
          let i_0 = (Math.floor(i / 3) * 3) + Math.floor(j / 3);
          let j_0 = ((i % 3) * 3) + (j % 3);
          let i_1 = (Math.floor(i / 3) * 3) + Math.floor(k / 3);
          let j_1 = ((i % 3) * 3) + (k % 3);
          solver.add(z3Grid[i_0][j_0].neq(z3Grid[i_1][j_1]));
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
