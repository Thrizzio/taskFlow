// Function declaration hoisting
sayHello();

function sayHello() {
    return "Hello";
}


// var hoisting
console.log(varValue);

var varValue = 10;


// let — Temporal Dead Zone
console.log(letValue);

let letValue = 10;


// const — Temporal Dead Zone
console.log(constValue);

const constValue = 10;