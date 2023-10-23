import * as z3 from 'z3-solver';
import setup from './setup'
declare global {
  interface Window { z3Promise: ReturnType<typeof z3.init>; }
}

// Used in getValue to cache the HTMLInputElements
let getValueBlocks: {[index:string]:HTMLInputElement} = {};
function getValue(x:number, y:number):number{
  if (x < 1 || x > 9) {
    throw new Error(`Invalid value of ${x} for x`);
  }
  if (y < 1 || y > 9) {
    throw new Error(`Invalid value of ${y} for y`);
  }
  let key = `i${x}${y}`;
  if (key in getValueBlocks) {
    return parseInt(getValueBlocks[key].value);
  }
  let elem = (<HTMLInputElement>document.getElementById(key));
  if (elem === null || elem.value === "") {
    return 0;
  }
  // Cache because getElementById is slow
  getValueBlocks[`${x}${y}`] = elem;
  return parseInt(elem.value);
}

// Grabs the constraints div and gets the id's of all checked children inputs 
function getConstraints():string[]{
  let out:string[] = [];
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


let runBtn = document.getElementById('run')

if (runBtn === undefined || runBtn === null) {
  console.error("no run btn");
} else {
  runBtn.addEventListener('click', async event => {
    console.log(getConstraints());

    // We can likely put most of the checking logic in here
    //  I just copied what they had for Z3 and shoved it in here
    //  to make sure it wasn't just available at page run
    let { Z3 } = await window.z3Promise;
    let config = Z3.mk_config();
    let ctx = Z3.mk_context_rc(config);
    Z3.del_config(config);

    let command = `
      (declare-const a Int)
      (declare-fun f (Int Bool) Int)
      (assert (< a 10))
      (assert (< (f a true) 100))
      (check-sat)
      (get-model)
    `;
    console.log(await Z3.eval_smtlib2_string(ctx, command));
    Z3.del_context(ctx);
    console.log('### running the high-level API')
    // use the high-level API:
    let { Context } = await window.z3Promise;
    let { Solver, Int } = Context('main');
    let solver = new Solver();
    let x = Int.const('x');
    solver.add(x.add(5).eq(9));
    console.log(await solver.check());
    console.log('x is', solver.model().get(x).toString());
  });
}


(async () => {
  // use the low-level API:
  console.log('### running the low-level API')
  let { Z3 } = await window.z3Promise;
  let config = Z3.mk_config();
  let ctx = Z3.mk_context_rc(config);
  Z3.del_config(config);

  for (let y = 1; y <= 9; y++) {
    let o = ""
    for (let x = 1; x <= 9; x++) {
      o += getValue(x,y)
    }
    console.log(o)
  }

  let command = `
    (declare-const a Int)
    (declare-fun f (Int Bool) Int)
    (assert (< a 10))
    (assert (< (f a true) 100))
    (check-sat)
    (get-model)
  `;
  console.log(await Z3.eval_smtlib2_string(ctx, command));
  Z3.del_context(ctx);



  console.log('### running the high-level API')
  // use the high-level API:
  let { Context } = await window.z3Promise;
  let { Solver, Int } = Context('main');
  let solver = new Solver();
  let x = Int.const('x');
  solver.add(x.add(5).eq(9));
  console.log(await solver.check());
  console.log('x is', solver.model().get(x).toString());
})().catch(e => {
  console.error(e);
});
