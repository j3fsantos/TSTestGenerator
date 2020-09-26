var esprima = require('esprima');
var escodegen = require('escodegen');
var fs = require('fs');
import finder = require("./finder");
import ts = require("typescript");


//Class used to store the Cosette functions
class CosetteFunctions {
  number_creator:string = "symb_number"
  string_creator:string = "symb_string"

  numberCreator(x:string):string{
    return `${this.number_creator}(${x})`
  }

  stringCreator(x:string):string{
    return `${this.string_creator}(${x})`
  }

  assertCreator(x:string,t:string):string{
    return `Assert(typeof ${x} === "${t}");`
  }
}

var cosFunc = new CosetteFunctions(); 


//Limit of the branching
const BRANCHING_LIMIT = 3;
const FUEL = 3;


//Constants created for string manipulation later
const ENTER_FUNC = str2ast("$Enter$()");
const SPACE_STR = "$Space$";
const COLONS_STR = "$Colons$";
const APOSTROPHE_STR = "$Apostrophe$";


//::::::::Turns ast into string::::::::
function ast2str (e) {

     try { 
      const option = {
        format : {
          quotes : 'single',
          indent : {
            style : '\t'
          }
        }
      }; 
      return escodegen.generate(e, option);
     } catch (err) { 
      if ((typeof e) === "object") { 
        console.log("converting the following ast to str:\n" + e);
      } else { 
        console.log("e is not an object!!!")
      }
      throw "ast2str failed."; 
     }
}


//::::::::Turns string into ast::::::::
function str2ast (str:string) {
  var ast = esprima.parse (str); 

  return ast.body[0];
}


//::::::::Function used to create some special characters in the output file::::::::
function stringManipulation(test_str:string):string{

  var test_str_ret1 = test_str.split("$Enter$();").join("");
  var test_str_ret2 = test_str_ret1.split("Comment1").join("/* ");
  var test_str_ret3 = test_str_ret2.split("Comment2();").join(" */");
  var test_str_ret4 = test_str_ret3.split("$Space$").join(" ");
  var test_str_ret5 = test_str_ret4.split("$Colons$").join(": ");
  var test_str_ret6 = test_str_ret5.split("$Apostrophe$").join("'");

  return test_str_ret6;
}


//::::::::Checks if the given type is a function type::::::::
function isFunctionType(arg_type:ts.Type,program_info:finder.ProgramInfo){

  var arg_str =program_info.Checker.typeToString(arg_type);
  return arg_str.includes("=>"); 
}


//::::::::Checks if the given type is an array type::::::::
function isArrayType(arr_type:ts.Type){
  return arr_type.symbol && arr_type.symbol.name==="Array";
}


//::::::::Checks if the given type is an union type::::::::
function isUnionType(union_type:ts.Type){
  return union_type.hasOwnProperty("types");
}


//::::::::Function used to create the name of some type of variable with the respective number::::::::
function makeFreshVariable (prefix:string) {
  var count = 0; 

  return function () { 
     count++;  
     return prefix + "_" + count;      
  }
}

//::::::::Function used to create the name of a variable with the respective number::::::::
var freshXVar = makeFreshVariable("x"); 
//::::::::Function used to create the name of an assert variable with the respective number::::::::
var freshAssertVar = makeFreshVariable("a"); 
//::::::::Function used to create the name of an object with the respective number::::::::
var freshObjectVar = makeFreshVariable("obj");
//::::::::Function used to create the name of a mock function with the respective number::::::::
var freshMockFuncVar = makeFreshVariable("mockFunc");
//::::::::Function used to create the name of an array with the respective number::::::::
var freshArrayVar = makeFreshVariable("arr");
//::::::::Function used to create the name of a control variable -> used to select the number of elements of an array ::::::::
var freshControlArrVar = makeFreshVariable("control_arr");
//::::::::Function used to create the name of a control variable -> used to select which object constructor will be used ::::::::
var freshControlObjVar = makeFreshVariable("control_obj");
//::::::::Function used to create the name of a fuel variable with the respective number ::::::::
var freshFuelVar = makeFreshVariable("fuel");
//::::::::Function used to create the name of an union variable with the respective number ::::::::
var freshUnionVar = makeFreshVariable("union");
//::::::::Function used to create the name of a control variable -> used to select which assigment will be made to the union::::::::
var freshControlUnionVar = makeFreshVariable("control_union");


//::::::::Function used to generate the combinations for the control vars::::::::
function createCombinations(args) {
  var r = [];
  var max = args.length-1;
  function helper(arr, i) {
      for (var j=0, l=args[i].length; j<l; j++) {
          var a = arr.slice(0); // clone arr
          a.push(args[i][j]);
          if (i==max)
              r.push(a);
          else
              helper(a, i+1);
      }
  }
  helper([], 0);
  return r;
}


//::::::::Function used to assign a string symbol to a variable::::::::
function createStringSymbAssignment () { 
  var x = freshXVar(); 
  var ret_str = `var ${x} = ${cosFunc.stringCreator(x)}`; 

  return {
      stmts: [str2ast(ret_str)], 
      var: x 
  } 
}


//::::::::Function used to assign a numerical symbol to a variable::::::::
function createNumberSymbAssignment () { 
    var x = freshXVar(); 
    var ret_str = `var ${x} = ${cosFunc.numberCreator(x)}`; 

    return {
        stmts: [str2ast(ret_str)], 
        var: x 
    } 
}


//::::::::This function creates the name for the create object function::::::::
function getCreateMethodName(class_name:string):string{
  return "create"+class_name;
}


//::::::::This function generates the call of a constructor recursively with symbolic parameters::::::::
function createObjectRecursiveCall(class_name:string,fuel_var:string){
  var recurs_obj_var = freshObjectVar()
  var call = `var ${recurs_obj_var} = ${getCreateMethodName(class_name)}(${fuel_var});`;
  return {
    stmts: [ str2ast(call) ],
    var: recurs_obj_var
  }
}

function generateIfFuelStatement(fuel_var:string){
  return {
    type: "IfStatement",
    test: {
      type: "BinaryExpression",
      operator: "===",
      left: {
        type: "MemberExpression",
        computed: false,
        object: {
          type: "Identifier",
          name: fuel_var
        },
        property: {
          type: "Identifier",
          name: "length"
        }
      },
      right: {
        type: "Literal",
        value: 0,
        raw: "0"
      }
    },
    consequent: {
      type: "ReturnStatement",
      argument: {
        type: "Literal",
        value: null,
        raw: "null"
      }
    },
    alternate: null
  }
}


//::::::::This function generates the call of a return statement given a class and its arguments::::::::
function generateReturnCall(class_name:string,args:string[]){
  var args_ast = args.map(x=>{return{
          type: "Identifier",
          name: x
        }});
    
  return {
    type: "ReturnStatement",
    argument: {
      type: "NewExpression",
      callee: {
        type: "Identifier",
        name: class_name
      },
      arguments: args_ast
    }
  }
}


//::::::::This function generates the call of a constructor that needs recursive behaviour with symbolic parameters::::::::
function createObjectRecursiveSymbParams(class_name:string, program_info:finder.ProgramInfo){
  
  var symb_vars = [];
  var stmts = []; 
  var objs = [];
  var control_vars = [];
  var control_nums = [];

  var fuel_var = freshFuelVar();
  var control_obj_var = freshControlObjVar();
  var if_has_fuel_ast = generateIfFuelStatement(fuel_var);
  stmts.push(if_has_fuel_ast);

  var fuel_pop_str = `var ${control_obj_var} = ${fuel_var}.pop();`
  stmts.push(str2ast(fuel_pop_str));

  for(var i=0; i<program_info.ConstructorsInfo[class_name].length; i++){
    symb_vars=[];

    var ret = createArgSymbols(program_info.ConstructorsInfo[class_name][i].arg_types,program_info,fuel_var);
    symb_vars = symb_vars.concat(ret.vars);
    if(ret.control!==undefined){
      control_vars = control_vars.concat(ret.control);
      control_nums = control_nums.concat(ret.control_num);
    }

    var obj_ret = generateReturnCall(class_name,ret.vars);
    objs.push(generateBlock(ret.stmts.concat(obj_ret)));
    
  }

  var switch_stmt = createSwitchStmt(control_obj_var, objs);
  stmts.push(switch_stmt); 

  stmts.push(ENTER_FUNC);

  control_nums.push(program_info.ConstructorsInfo[class_name].length);

  control_vars.unshift(fuel_var);

  return createFunctionDeclaration(getCreateMethodName(class_name),stmts,control_vars);
}


//::::::::This function generates the call of a constructor with symbolic parameters::::::::
function createObjectSymbParams(class_name:string, program_info:finder.ProgramInfo){
  var symb_vars = [];
  var stmts = []; 
  var objs = [];
  var control_vars = [];
  var control_nums = [];

  var obj = freshObjectVar();

  var obj_str = `var ${obj}`; 
  stmts.push(str2ast(obj_str));

  for(var i=0; i<program_info.ConstructorsInfo[class_name].length; i++){
    symb_vars=[];

    var ret = createArgSymbols(program_info.ConstructorsInfo[class_name][i].arg_types,program_info);
    symb_vars = symb_vars.concat(ret.vars);
    if(ret.control!==undefined){
      control_vars = control_vars.concat(ret.control);
      control_nums = control_nums.concat(ret.control_num);
    }

    obj_str =`${obj} = new ${class_name}(${ret.vars_str})`;
    objs.push(generateBlock(ret.stmts.concat(str2ast(obj_str))));
  }

  if(program_info.ConstructorsInfo[class_name].length>1){
    var control_var = freshControlObjVar(); 
    var switch_stmt = createSwitchStmt(control_var, objs);
    stmts.push(switch_stmt); 
  }
  else{
    stmts.push(objs[0]);
  }
  stmts.push(ENTER_FUNC);

  control_vars.push(control_var);
  control_nums.push(program_info.ConstructorsInfo[class_name].length);

  return {
    stmts: stmts,
    var:obj,
    control: control_vars,
    control_num: control_nums
  }
}


//::::::::Function used to make a symbol assignment to a variable::::::::
function createSymbAssignment (arg_type:ts.Type,program_info:finder.ProgramInfo,fuel_var?:string) { 

  var type_str = program_info.Checker.typeToString(arg_type);

  switch (type_str) {
    case "string" : return createStringSymbAssignment(); 

    case "number" : return createNumberSymbAssignment();

    default:
      if (program_info.hasClass(type_str)) {

        if(program_info.cycles_hash[type_str]){
          return createObjectRecursiveCall(type_str,fuel_var);
        } else {
          return createObjectSymbParams(type_str,program_info);
        }
      } 
      
      else if(isFunctionType(arg_type,program_info)){
        var ret_func_elements = getFunctionElements(arg_type,program_info);
        return createMockFunction(ret_func_elements.params, ret_func_elements.ret, program_info);
      } 
      
      else if(isArrayType(arg_type)){
        return createArrayOfType(arg_type,program_info);
      } 

      else if(isUnionType(arg_type)){
        return createUnionType(arg_type,program_info);
      } 

      else {
        throw new Error ("createSymbAssignment: Unsupported type");
      }
  }
}


//::::::::Function used to create the symbol of the arguments::::::::
function createArgSymbols(arg_types:ts.Type[],program_info:finder.ProgramInfo,fuel_var?:string){
  var symb_vars = [];
  var stmts = []; 
  var control_vars = [];
  var control_nums = [];

  for (var i=0; i<arg_types.length; i++) {
    var ret = createSymbAssignment(arg_types[i],program_info,fuel_var);
    stmts = stmts.concat(ret.stmts); 
    symb_vars.push(ret.var); 
    if(ret.control!==undefined){
      control_vars = control_vars.concat(ret.control);
      control_nums = control_nums.concat(ret.control_num);
    }
      
  }

  var args_str = symb_vars.reduce(function (cur_str, prox) {
    if (cur_str === "") return prox; 
    else return cur_str + ", " + prox; 
  },"");


  return{
    stmts:stmts,
    vars:symb_vars,
    vars_str:args_str,
    control: control_vars,
    control_num: control_nums
  }
}


//::::::::Function used to create an identifier::::::::
function createIdentifier(x){
  return {
    type:"Identifier",
    name:x
  }
}


//::::::::Function used to create a function declaration::::::::
function createFunctionDeclaration(method_name:string,stmts,params_str:string[]){
  var params = [];
  for(var i=0;i<params_str.length;i++){
    params.push({
      type:"Identifier",
      name: params_str[i]
    })
  }

  return{
    type : "FunctionDeclaration",
    id : createIdentifier(method_name),
    params : params,
    body : generateBlock(stmts),
    generator : false,
    expression : false,
    async : false
  }
}


//::::::::This function generates the call to a function::::::::
function createCall(fun_name:string, arg_types:ts.Type[], program_info:finder.ProgramInfo){
  var stmts = [];

  var ret_args = createArgSymbols(arg_types,program_info);
  stmts = stmts.concat(ret_args.stmts);
  var call = `${fun_name}(${ret_args.vars_str});`
  stmts.push(str2ast(call));
  return stmts;
}


//::::::::This function generates a mock function used as other function argument::::::::
function createMockFunction(arg_types:ts.Type[],ret_type:ts.Type,program_info:finder.ProgramInfo){
  var calls = [];
  
  var ret_val = createSymbAssignment(ret_type,program_info);
  
  var ret_args = createArgSymbols(arg_types,program_info);

  for(var i=0;i<arg_types.length;i++){
    if(isFunctionType(arg_types[i],program_info)){
      var function_elements = getFunctionElements(arg_types[i],program_info);
      calls=calls.concat(createCall(ret_args.vars[i], function_elements.params,program_info));
    }
  }
  calls.push(ret_val.stmts[0]);
  var block_stmt = generateBlock(calls);
  var fun_name = freshMockFuncVar();
  var fun_str= `function ${fun_name} (${ret_args.vars_str}) {
  ${ast2str(block_stmt)}
  return ${ret_val.var};
  }`;
  
  return {
    stmts: [str2ast(fun_str)],
    var: fun_name
  }
}


//::::::::This function creates the default case of the switch::::::::
function createDefaultCaseStmt(block) {
  return {
    type: "SwitchCase",
    test: null,
    consequent: [ block ]
  }
}


//::::::::This function creates a case of the switch ::::::::
function createCaseStmt (i, block) {
  return {
    type: "SwitchCase",
    test: {
      "type": "Literal",
      "value": i+1,
      "raw": (i+1)+""
    },
    consequent: [ block,{
      type: "BreakStatement",
      test: null
    } ]
  }
}


//::::::::This function creates a switch statement::::::::
function createSwitchStmt (control_var, blocks) {
  var cases = [];
  
  for (var i=0; i<blocks.length-1; i++) {
    cases.push(createCaseStmt(i, blocks[i]));
    cases.push(ENTER_FUNC);
  }
  cases.push(createDefaultCaseStmt(blocks[blocks.length-1]));
  cases.push(ENTER_FUNC);

  return {
    type: "SwitchStatement",
    discriminant: {
      type: "Identifier",
      name: control_var
    },
    cases: cases
  }
}


//::::::::This function generates an array of its type::::::::
function createArrayOfType(arr_type:ts.Type,program_info:finder.ProgramInfo){
  var stmts = [];
  var symb_vars = [];
  var arrays = [];
  var control_vars = [];
  var control_nums = [];

  var arr = freshArrayVar();
  
  var arg_type = arr_type.getNumberIndexType();
  
  var arr_str = `var ${arr}`; 
  stmts.push(str2ast(arr_str));

  for(var i =0;i<BRANCHING_LIMIT;i++){
    var ret = createSymbAssignment(arg_type,program_info);

    if(ret.control!==undefined){
      control_vars = control_vars.concat(ret.control);
      control_nums = control_nums.concat(ret.control_num);
    }    
  
    stmts = stmts.concat(ret.stmts);
    symb_vars.push(ret.var); 

    var args_str = symb_vars.reduce(function (cur_str, prox) {
      if (cur_str === "") return prox; 
      else return cur_str + ", " + prox; 
    },"");
  
    arr_str =`${arr} = [${args_str}]`;
    arrays.push(str2ast(arr_str));
  }

  var control_var = freshControlArrVar(); 
  var switch_stmt = createSwitchStmt(control_var, arrays);
  stmts.push(switch_stmt); 
  stmts.push(ENTER_FUNC);

  control_vars.push(control_var);
  control_nums.push(BRANCHING_LIMIT);
  
  return {
    stmts:stmts,
    var: arr, 
    control: control_vars,
    control_num: control_nums
  }
}


//::::::::This function gets the parameters and return types of a function::::::::
function getFunctionElements(arg_type:ts.Type,program_info:finder.ProgramInfo){
  var params = [];

  for (const signature of arg_type.getCallSignatures()){
    for(const parameter of signature.parameters){
      var parameter_type = program_info.Checker.getTypeOfSymbolAtLocation(parameter, parameter.valueDeclaration!);
      params.push(parameter_type);
    }
    var ret_type = signature.getReturnType();
  }

  return {
    params:params,
    ret: ret_type
  }
}


//::::::::This function generates a symbolic assignment for each type in the union::::::::
function createUnionType(arg_type:ts.Type,program_info:finder.ProgramInfo){
  var stmts = [];
  var symb_vars = [];
  var unions = [];
  var control_vars = [];
  var control_nums = [];

  var union = freshUnionVar();
  
  var union_str = `var ${union}`; 
  stmts.push(str2ast(union_str));

  for(var i =0;i<arg_type["types"].length;i++){
    var ret = createSymbAssignment(arg_type["types"][i],program_info);

    if(ret.control!==undefined){
      control_vars = control_vars.concat(ret.control);
      control_nums = control_nums.concat(ret.control_num);
    }    
    symb_vars.push(ret.var);
  
    union_str =`${union} = ${ret.var}`;
    unions.push(generateBlock(ret.stmts.concat(str2ast(union_str))));
  }

  var control_var = freshControlUnionVar(); 
  var switch_stmt = createSwitchStmt(control_var, unions);
  stmts.push(switch_stmt); 
  stmts.push(ENTER_FUNC);

  control_vars.push(control_var);
  control_nums.push(arg_type["types"].length);
  
  return {
    stmts:stmts,
    var: union, 
    control: control_vars,
    control_num: control_nums
  }
}

//::::::::This function generates the mock constructor for an interface::::::::
function createInterfaceMockConstructor(interface_name:string, program_info:finder.ProgramInfo){
  var stmts = [];
  var control_vars = [];
  var control_nums = [];

  Object.keys(program_info.PropertiesInfo[interface_name]).forEach(function (property_name) {
    var ret = createSymbAssignment(program_info.PropertiesInfo[interface_name][property_name],program_info);
    stmts=stmts.concat(ret.stmts); 
    var property_assigment_str = `this.${property_name} = ${ret.var};`
    stmts.push(str2ast(property_assigment_str));

    if(ret.control!==undefined){
      control_vars = control_vars.concat(ret.control);
      control_nums = control_nums.concat(ret.control_num);
    }    
  });
  
  return {
    stmts:createFunctionDeclaration(interface_name,stmts,control_vars),
    control: control_vars,
    control_num: control_nums
  }
}


//::::::::This function generates the call of all the constructors of a class::::::::
function generateConstructorTests(class_name:string,program_info:finder.ProgramInfo){
  var symb_vars = [];
  var stmts = []; 
  var objs = [];
  var control_vars = [];
  var control_nums = [];

  stmts.push(ENTER_FUNC);
  for(var i=0; i<program_info.ConstructorsInfo[class_name].length; i++){
    symb_vars=[];

    for (var j=0; j<program_info.ConstructorsInfo[class_name][i].arg_types.length; j++) { 
      var ret = createSymbAssignment(program_info.ConstructorsInfo[class_name][i].arg_types[j],program_info);
      stmts=stmts.concat(ret.stmts); 
      symb_vars.push(ret.var); 
      if(ret.control!==undefined){
        control_vars = control_vars.concat(ret.control);
        control_nums = control_nums.concat(ret.control_num);
      } 
    }

    var obj = freshObjectVar();
    objs[i] = obj;
    var constructor_args_str = symb_vars.reduce(function (cur_str, prox) {
      if (cur_str === "") return prox; 
      else return cur_str + ", " + prox; 
    },"");  

    var constructor_ret_str =`var ${obj} = new ${class_name}(${constructor_args_str})`;
    var constructor_ret_stmt = str2ast(constructor_ret_str); 
    stmts.push(constructor_ret_stmt);
    stmts.push(ENTER_FUNC);
  }

  return {
    stmt:createFunctionDeclaration("test_"+class_name+"_constructors",stmts,control_vars),
    control: control_vars,
    control_num: control_nums
  }
}


//::::::::This function generates a method test function:::::::
function generateMethodTest(class_name:string, method_name:string,method_number_test:number,program_info:finder.ProgramInfo){
  var stmts = [];
  var control_vars = [];
  var control_nums = [];
  var method_info = program_info.MethodsInfo[class_name][method_name];

  stmts.push(ENTER_FUNC);

  //Object creation
  var ret_obj = createObjectSymbParams(class_name,program_info);
  stmts=stmts.concat(ret_obj.stmts);
  if(ret_obj.control[0]!==undefined){
    control_vars = control_vars.concat(ret_obj.control);
    control_nums = control_nums.concat(ret_obj.control_num);
  }
    
  
  //Args symbols creation
  var ret_args = createArgSymbols(method_info.arg_types,program_info);
  stmts=stmts.concat(ret_args.stmts);
  if(ret_args.control[0]!==undefined){
    control_vars = control_vars.concat(ret_args.control);
    control_nums = control_nums.concat(ret_args.control_num);
  }

  //Method call creation
  var x = freshXVar();
  var ret_str = `var ${x} = ${ret_obj.var}.${method_name}(${ret_args.vars_str})`;
  var ret_ast = str2ast(ret_str);
  stmts.push(ret_ast);
  
  //Final assert creation
  var ret_asrt = generateFinalAsrt(method_info.ret_type,x,program_info);
  stmts.push(ret_asrt.stmt);
  stmts.push(str2ast(`Assert(${ret_asrt.var})`));

  stmts.push(ENTER_FUNC); 

  return {
    stmt: createFunctionDeclaration("test"+method_number_test+"_"+method_name,stmts,control_vars),
    control: control_vars,
    control_num: control_nums
  }
}


//::::::::This function generates a function test function::::::::
function generateFunctionTest(fun_name:string,fun_number_test:number,program_info:finder.ProgramInfo){
  var stmts = [];
  var control_vars = [];
  var control_nums = [];
  var function_info=program_info.FunctionsInfo[fun_name];

  stmts.push(ENTER_FUNC);

  //Args symbols creation
  var ret_args = createArgSymbols(function_info.arg_types,program_info);
  stmts=stmts.concat(ret_args.stmts);
  if(ret_args.control[0]!==undefined){
    control_vars = control_vars.concat(ret_args.control);
    control_nums = control_nums.concat(ret_args.control_num);
  }
    

  //Function call creation
  var x =freshXVar();
  var ret_str = `var ${x} = ${fun_name}(${ret_args.vars_str})`;
  var ret_ast = str2ast(ret_str);
  stmts.push(ret_ast);  
  
  //Final assert creation
  var ret_asrt=generateFinalAsrt(function_info.ret_type,x,program_info);
  stmts.push(ret_asrt.stmt);

  stmts.push(str2ast(`Assert(${ret_asrt.var})`));
  stmts.push(ENTER_FUNC); 

  return {
    stmt: createFunctionDeclaration("test"+fun_number_test+"_"+fun_name,stmts,control_vars),
    control: control_vars,
    control_num: control_nums
  }
}


//::::::::This function generates an assertion to check if the return type of a function is a string:::::::: 
function generateFinalStringAsrt(ret_var:string) { 
    var x = freshAssertVar();
    
    var ret_str = `var ${x} = typeof ${ret_var} === "string";`; 
    return {
      stmt:str2ast(ret_str),
      var:x
    } 
}

//::::::::This function generates an assertion to check if the return type of a function is a number:::::::: 
function generateFinalNumberAsrt(ret_var:string) { 
  var x = freshAssertVar();

    var ret_str = `var ${x} = typeof ${ret_var} === "number";`; 
    return {
      stmt:str2ast(ret_str),
      var:x
    }
}

//::::::::This function generates an assertion to check if the return type of a function is an instance of an object::::::::
function generateFinalObjectAsrt(ret_var:string,ret_type: string) { 
  var x = freshAssertVar();

  var ret_str = `var ${x} = ${ret_var} instanceof ${ret_type};`; 
  return {
    stmt:str2ast(ret_str),
    var:x
  }
}

//::::::::This function generates an assertion to check if the return type of a function is an instance of an object::::::::
function generateFinalUnionAsrt(ret_var:string,ret_types: string[]) { 
  var x = freshAssertVar();

  var ret_str = `var ${x} = (${ret_var} typeof ${ret_types[0]}`; 
  for(var i = 1;i<ret_types.length;i++)
    ret_str += ` || ${ret_var} typeof ${ret_types[i]}`
  ret_str += `);`
  console.log(ret_str);
  return {
    stmt:str2ast(ret_str),
    var:x
  }
}

//::::::::This function generates an assertion to check the return type ::::::::
function generateFinalAsrt (ret_type:ts.Type, ret_var:string, program_info : finder.ProgramInfo) {

  var ret_type_str=program_info.Checker.typeToString(ret_type);
  
   switch(ret_type_str) {
      case "string" : return generateFinalStringAsrt(ret_var); 

      case "number" : return generateFinalNumberAsrt(ret_var); 
      
      default: 
        if (program_info.hasClass(ret_type_str)) {
          return  generateFinalObjectAsrt(ret_var, ret_type_str);
        } 
  
        else if(isUnionType(ret_type)){
          var ret_types:string[] = []
          for(var i = 0;i<ret_type["types"].length;i++)
            ret_types.push(program_info.Checker.typeToString(ret_type["types"][i]));
          return generateFinalUnionAsrt(ret_var,ret_types);
        } 
        
        else {
          throw new Error ("generateFinalAsrt: Unsupported type")
        }
   }
}


//::::::::This function generates the output block::::::::
function generateBlock(stmts) {
    return {
        type: "BlockStatement",
        body: stmts
    }
}


//::::::::This fucntion is responsible for genarating the program tests::::::::
export function generateTests(program_info : finder.ProgramInfo,output_dir:string, js_file:string):string{

  var fun_names = [];
  var num_fun = 0;
  var tests = [];
  var curr_test = "";
  var number_test:finder.HashTable<number> = {};
  var recursive_create_functions:finder.HashTable<string> = {};
  var constant_code_str:string = "";
  var max_constructors_recursive_objects:number = 0;

  //Create functions ganerated for when there is cyclic construction in the objects 
  Object.keys(program_info.cycles_hash).forEach(function (class_name) {
    var recursive_create_function = createObjectRecursiveSymbParams(class_name,program_info);
    tests.push(recursive_create_function);
    recursive_create_functions[class_name] = ast2str(recursive_create_function);
    constant_code_str += ast2str(recursive_create_function)+"\n\n";

    if(max_constructors_recursive_objects < program_info.ConstructorsInfo[class_name].length)
      max_constructors_recursive_objects = program_info.ConstructorsInfo[class_name].length;
  });
  console.log("Max number of constructors of cyclic objects: "+max_constructors_recursive_objects);

  tests.push(ENTER_FUNC);

  //Creation of Mock constructors and methods for interfaces
  Object.keys(program_info.InterfacesInfo).forEach(function (interface_name) {
    var interface_mock_constructor = createInterfaceMockConstructor(interface_name,program_info);
    constant_code_str += ast2str(interface_mock_constructor.stmts)+"\n\n";

    Object.keys(program_info.MethodsInfo[interface_name]).forEach(function (method_name) {
      var interface_method_info = program_info.MethodsInfo[interface_name][method_name];
      var interface_mock_method = createMockFunction(interface_method_info.arg_types,interface_method_info.ret_type,program_info);
      constant_code_str += interface_name+".prototype."+method_name+" = "+ast2str(interface_mock_method.stmts[0])+"\n\n";
    });
  });


  //Constructors tests will be created
  Object.keys(program_info.ConstructorsInfo).forEach(function (class_name) { 

    curr_test = constant_code_str+"\n";

    if(number_test[class_name] === undefined)
      number_test[class_name] = 1;
    else
      number_test[class_name]++;

    var comment = "Comment1Test"+SPACE_STR+"of"+SPACE_STR+class_name+APOSTROPHE_STR+"s"+SPACE_STR+"constructors"+"Comment2();";
    tests.push(str2ast(comment));
    curr_test += comment+"\n";

    var ret = generateConstructorTests(class_name,program_info);
    tests.push(ret.stmt);
    curr_test+=ast2str(ret.stmt)+"\n";

    tests.push(ENTER_FUNC);

    var all_cases = [];
    var cases;
    for(var i = 0; i<ret.control.length; i++){
      cases = [];
      for (var j=0;j<ret.control_num.length;j++){
        cases.push(j+1);
      }
      all_cases.push(cases);
    }

    var constructor_call_str;
    var constructor_call;
    if(all_cases.length>0){
      var combinations = createCombinations(all_cases);
      
      for(var i = 0;i<combinations.length;i++){
        constructor_call_str = "test_"+class_name+"_constructors("+combinations[i]+");";
        constructor_call = str2ast(constructor_call_str);
        tests.push(constructor_call);
        curr_test += "\n"+constructor_call_str;
        tests.push(ENTER_FUNC); 
      }
    }

    else{
      constructor_call_str = "test_"+class_name+"_constructors();";
      constructor_call = str2ast(constructor_call_str);
      tests.push(constructor_call);
      curr_test += "\n"+constructor_call_str;
      tests.push(ENTER_FUNC); 
    }

    fs.writeFileSync(output_dir+"/test_"+class_name+"_constructors.js",js_file+"\n\n"+stringManipulation (curr_test));

    fun_names[num_fun] = constructor_call_str;
    num_fun++;
  });

  //Methods tests will be created
  Object.keys(program_info.MethodsInfo).forEach(function (class_name) { 
    Object.keys(program_info.MethodsInfo[class_name]).forEach(function (method_name){

      curr_test = constant_code_str+"\n";

      if(number_test[method_name] === undefined)
        number_test[method_name]=1;
      else
        number_test[method_name]++;
      
      var comment = "Comment1Test"+SPACE_STR+"of"+SPACE_STR+class_name+APOSTROPHE_STR+"s"+SPACE_STR+"method"+COLONS_STR+method_name+"Comment2();";
      tests.push(str2ast(comment));
      curr_test += comment+"\n";

      var ret = generateMethodTest(class_name,method_name,number_test[method_name],program_info);
      tests.push(ret.stmt);
      curr_test += ast2str(ret.stmt)+"\n";

      tests.push(ENTER_FUNC);

      var all_cases = [];
      var cases;
      for(var i = 0; i<ret.control.length; i++){
        cases = [];
        for (var j=0;j<ret.control_num[i];j++){
          cases.push(j+1);
        }
        all_cases.push(cases);
      }
  
      
      var method_call_str;
      var method_call;
      if(all_cases.length>0){
        var combinations = createCombinations(all_cases);
        for(var i = 0;i<combinations.length;i++){
          method_call_str = "test"+number_test[method_name]+"_"+method_name+"("+combinations[i]+");";
          method_call = str2ast(method_call_str);
          tests.push(method_call);
          curr_test += "\n"+method_call_str;
          tests.push(ENTER_FUNC); 
        }
      }
      
      else{
        method_call_str = "test"+number_test[method_name]+"_"+method_name+"();"
        method_call = str2ast(method_call_str);
        tests.push(method_call);
        curr_test += "\n"+method_call_str;
        tests.push(ENTER_FUNC); 
      }

      fs.writeFileSync(output_dir+"/test"+number_test[method_name]+"_"+method_name+".js",js_file+"\n\n"+stringManipulation (curr_test));

      fun_names[num_fun] = method_call_str;
      num_fun++;
    });
  });


  //Functions tests will be created
  Object.keys(program_info.FunctionsInfo).forEach(function (fun_name) { 

    curr_test = constant_code_str+"\n";

    if(number_test[fun_name] === undefined)
      number_test[fun_name]=1;
    else
      number_test[fun_name]++;

    var comment = "Comment1Test"+SPACE_STR+"of"+SPACE_STR+"function"+COLONS_STR+fun_name+"Comment2();";
    tests.push(str2ast(comment));
    curr_test += comment+"\n";

    var ret = generateFunctionTest(fun_name,number_test[fun_name],program_info);
    tests.push(ret.stmt);
    curr_test += ast2str(ret.stmt)+"\n";

    tests.push(ENTER_FUNC);

    /*
    var fun_call_str;
    var fun_call;
    var symbolic_cases_vars = [];

    for(var i = 0; i<ret.control.length; i++){
      var symbolic_case = createNumberSymbAssignment();
      curr_test += "\n"+ast2str(symbolic_case.stmts[0]);
      tests=tests.concat(symbolic_case.stmts);
      symbolic_cases_vars.push(symbolic_case.var);
    }

    if(symbolic_cases_vars.length>0){
      var arg_str = symbolic_cases_vars[0];
      
      for(var i = 1;i<symbolic_cases_vars.length;i++)
        arg_str += ", "+symbolic_cases_vars[i];

      fun_call_str ="test"+number_test[fun_name]+"_"+fun_name+"("+arg_str+");";
      fun_call = str2ast(fun_call_str);
      tests.push(fun_call);
      curr_test += "\n"+fun_call_str;
      tests.push(ENTER_FUNC); 
    }

    else{
      fun_call_str ="test"+number_test[fun_name]+"_"+fun_name+"();"
      fun_call = str2ast(fun_call_str);
      tests.push(fun_call);
      curr_test += "\n"+fun_call_str;
      tests.push(ENTER_FUNC); 
    } 
      
    
    var all_cases = [];
    var cases = [1,2,3];
    for(var i = 0; i<ret.control.length; i++)
      all_cases.push(cases);
    */

   var all_cases = [];
   var cases;
   for(var i = 0; i<ret.control.length; i++){
     cases = [];
     for (var j=0;j<ret.control_num[i];j++){
       cases.push(j+1);
     }
     all_cases.push(cases);
   }

    var fun_call_str;
    var fun_call;
    if(all_cases.length>0){
      var combinations = createCombinations(all_cases);
      for(var i = 0;i<combinations.length;i++){
        fun_call_str = "test"+number_test[fun_name]+"_"+fun_name+"("+combinations[i]+");";
        fun_call = str2ast(fun_call_str);
        tests.push(fun_call);
        curr_test += "\n"+fun_call_str;
        tests.push(ENTER_FUNC); 
      }
    }

    else{
      fun_call_str = "test"+number_test[fun_name]+"_"+fun_name+"();"
      fun_call = str2ast(fun_call_str);
      tests.push(fun_call);
      curr_test += "\n"+fun_call_str;
      tests.push(ENTER_FUNC); 
    }
    
    fs.writeFileSync(output_dir+"/test"+number_test[fun_name]+"_"+fun_name+".js",js_file+"\n\n"+stringManipulation (curr_test));

    fun_names[num_fun]=fun_call_str;
    num_fun++;
  });


  var test_block = generateBlock(tests);
  var test_str = ast2str(test_block);

  //Manipulation of test file string to create special characters
  var test_str_final = stringManipulation(test_str);

  return "/*\n=====Function that will run the tests functions=====\n*/\nfunction Test() "+test_str_final+"\n\nTest();";
}
