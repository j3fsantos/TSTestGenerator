const fs = require('fs');
import * as finder from "./finder";
import {IProgramInfo} from "./IProgramInfo"
import * as constants from "./constants";
import * as utils from "./utils";
import * as freshVars from "./freshVars";
import * as TsASTFunctions from "./TsASTFunctions";
import * as generateSymbolicTypes from "./generateSymbolicTypes";
import * as generateSymbolicObjects from "./generateSymbolicObjects";
import * as generateSymbolicInterface from "./generateSymbolicInterface";
import * as generateSymbolicFunctions from "./generateSymbolicFunctions";
import * as generateTypesAssertions from "./generateTypesAssertions";

//::::::::This function generates the call of all the constructors of a class::::::::
function generateConstructorTests<ts_type>(class_name:string, program_info:IProgramInfo<ts_type>, output_dir:string){
  var stmts = [];
  var control_vars = [];
  var control_nums = [];
  var needs_for = false;
  var for_stmts = [];
  var fuel_var:string;
  var index:string;
  
  //Creation of the object
  var ret_obj;
  if(program_info.hasCycle(class_name)) {       //If the class is cyclic it automatically needs a 'for' for its construction 
    ret_obj = generateSymbolicObjects.createObjectRecursiveCall(class_name, program_info);
    needs_for = true;
    fuel_var = ret_obj["fuel_var"];
    index = ret_obj["index_var"];
  }

  else {
    ret_obj = generateSymbolicObjects.createObjectCall(class_name, program_info);
  }

  for_stmts = for_stmts.concat(ret_obj.stmts);
  //Checks if the object construction has more than one possible value for their arguments
  if(ret_obj.control[0]!==undefined){
    control_vars = control_vars.concat(ret_obj.control);
    control_nums = control_nums.concat(ret_obj.control_num);
  }

  if(needs_for) {

    stmts.push(utils.str2ast(constants.ENTER_STR));
    var new_fuel_arr = freshVars.freshFuelArrVar();
    for_stmts.unshift(utils.str2ast(`var ${fuel_var} = ${new_fuel_arr}[${index}]`));
    stmts.push(TsASTFunctions.generateForStatement(new_fuel_arr, index, for_stmts));
    control_vars.push(new_fuel_arr);
  }

  else {
    for(var i = 0; i<for_stmts.length; i++) {
      stmts.push(for_stmts[i]);
    }
  }
  
  return {
    stmt:TsASTFunctions.createFunctionDeclaration("test_"+class_name+"_constructors",stmts,control_vars),
    control: control_vars,
    control_num: control_nums
  }
}


//::::::::This function generates a method test function:::::::
function generateMethodTest<ts_type>(class_name:string, method_name:string,method_number_test:number,program_info:IProgramInfo<ts_type>){
  var stmts = [];
  var control_vars = [];
  var control_nums = [];
  var method_info = program_info.getClassMethodInfo(class_name, method_name);
  var needs_for = false;
  var new_fuel_vars:string[] = [];
  var index:string;
  
  stmts.push(utils.str2ast(constants.ENTER_STR));

  //Creation of the object where the method will be tested
  var ret_obj;
  if(program_info.hasCycle(class_name)) {       //If the class is cyclic it automatically needs a 'for' for its construction 
    ret_obj = generateSymbolicObjects.createObjectRecursiveCall(class_name, program_info);
    needs_for = true;
    new_fuel_vars.push(ret_obj["fuel_var"]);
  }

  else {
    ret_obj = generateSymbolicObjects.createObjectCall(class_name, program_info);
  }

  stmts = stmts.concat(ret_obj.stmts);
  //Checks if any argument has more than one possible value
  if(ret_obj.control[0]!==undefined){
    control_vars = control_vars.concat(ret_obj.control);
    control_nums = control_nums.concat(ret_obj.control_num);
  }
  
  //Creates the arguments of the method
  var ret_args = generateSymbolicTypes.createArgSymbols(method_info.arg_types,program_info);
  stmts = stmts.concat(ret_args.stmts);

  //Checks if any argument needs recursive construction
  if(ret_args["needs_for"]) {
    needs_for = true;
    new_fuel_vars = new_fuel_vars.concat(ret_args["fuel_var"]);       //Fuel array used for the recursive construction
  }

  //Checks if any argument has more than one possible value
  if(ret_args.control[0]!==undefined){
    control_vars = control_vars.concat(ret_args.control);
    control_nums = control_nums.concat(ret_args.control_num);
  }

  //Creates the method call which the return value will be put in a variable
  var x = freshVars.freshXVar();
  var ret_str = `var ${x} = ${ret_obj.var}.${method_name}(${ret_args.vars_str})`;
  var ret_ast = utils.str2ast(ret_str);
  stmts.push(ret_ast);

  //Creates the assertion of the variable with the method's return type to the expected return type
  var ret_asrt = generateTypesAssertions.generateFinalAsrt(method_info.ret_type,x,program_info);
  stmts = stmts.concat(ret_asrt.stmt);
  stmts.push(utils.str2ast(`Assert(${ret_asrt.var})`));

  for(var i = 0; i < control_vars.length; i++) {
    var control_var_declaration = TsASTFunctions.createControlVarDeclr(control_vars[i], control_nums[i]);
    stmts.unshift(control_var_declaration);
  }

  for(var i = 0; i < new_fuel_vars.length; i++) {
    var fuel_var_declaration = TsASTFunctions.createFuelVarDeclr(new_fuel_vars[i]);
    stmts.unshift(fuel_var_declaration);
  }

  var rets = [];
  method_name = "test"+method_number_test+"_"+method_name;
  rets.push ({
     stmt: TsASTFunctions.createFunctionDeclaration(method_name,stmts,[]),
     control: control_vars,
     control_num: control_nums
  })

  return rets
}


//::::::::This function generates a function test function::::::::
function generateFunctionTest<ts_type>(fun_name:string,fun_number_test:number,program_info:IProgramInfo<ts_type>){
  var stmts = [];
  var control_vars = [];
  var control_nums = [];
  var function_info=program_info.getFunctionInfo(fun_name);
  var for_stmts = [];
  var needs_for = false;
  var fuel_arr:string;
  var index:string;
  var new_fuel_vars:string[] = [];

  stmts.push(utils.str2ast(constants.ENTER_STR));

  //Creation the arguments of the function 
  var ret_args = generateSymbolicTypes.createArgSymbols(function_info.arg_types,program_info);
  stmts=stmts.concat(ret_args.stmts);

  //Checks if any argument needs recursive construction
  if(ret_args["needs_for"]) {
    needs_for = true;
    new_fuel_vars = new_fuel_vars.concat(ret_args["fuel_var"]);       //Fuel array used for the recursive construction
  }
  
  //Checks if any argument has more than one possible value
  if(ret_args.control[0]!==undefined){
    control_vars = control_vars.concat(ret_args.control);
    control_nums = control_nums.concat(ret_args.control_num);
  }
   
  //Creates the function call and places the return value in a variable 
  var x =freshVars.freshXVar();
  var ret_str = `var ${x} = ${fun_name}(${ret_args.vars_str})`;
  var ret_ast = utils.str2ast(ret_str);
  stmts.push(ret_ast);  

  //Creates the assertion of the variable with the function's return type to the expected return type
  var ret_asrt = generateTypesAssertions.generateFinalAsrt(function_info.ret_type,x,program_info);
  stmts = stmts.concat(ret_asrt.stmt);
  stmts.push(utils.str2ast(`Assert(${ret_asrt.var})`));
  
  for(var i = 0; i < control_vars.length; i++) {
    var control_var_declaration = TsASTFunctions.createControlVarDeclr(control_vars[i], control_nums[i]);
    stmts.unshift(control_var_declaration);
  }

  for(var i = 0; i < new_fuel_vars.length; i++) {
    var fuel_var_declaration = TsASTFunctions.createFuelVarDeclr(new_fuel_vars[i]);
    stmts.unshift(fuel_var_declaration);
  }

  var rets = [];
  var func_name = "test"+fun_number_test+"_"+fun_name;
  rets.push ({
    stmt: TsASTFunctions.createFunctionDeclaration(func_name,stmts, []),
    control: control_vars,
    control_num: control_nums
  })

  return rets;
}

function createFuelArrParams(fuel_vars_num:number):string[] {
  var fuel_vars:string[] = [];

  for(var i = 1; i <= fuel_vars_num; i++) {
    fuel_vars.push("fuel_arr_"+i);
  }
  
  return fuel_vars;
}

function createIntArray(n:number) : number[] {
  var arr = new Array(n);
  
  for(var i = 0; i < n; i++) {
    arr[i] = i;
  }

  return arr;
}

function createWrapperEnumeratorTest(fuel_vars_num:number, control_vars_num:number, control_nums:number[], func_name:string) {
  var stmts = [];

  var fuel_params = createFuelArrParams(fuel_vars_num);
  var control_arr_var = freshVars.freshControlArrVar();
  var control_param_str = control_vars_num > 0 ? ", "+control_arr_var+".length" : ""; 

  var length_fuel_vars_str = fuel_params.map(x=>x+".length").join(", ");
  var min_fuel_length_str = `var fuel_length = Math.min(${length_fuel_vars_str+control_param_str})`;
  stmts.push(utils.str2ast(min_fuel_length_str));

  var single_func_name = func_name+"_single";
  var indexed_fuel_vars = fuel_params.map(x=>x+"[i]");
  var control_vars = createIntArray(control_vars_num).map(x=>control_arr_var+"[i]["+x+"]");
  var single_func_args_str = indexed_fuel_vars.concat(control_vars).join(", ");
  var wrapper_for_code = `
    for(var i = 0; i < fuel_length; i++) {
		  ${single_func_name}(${single_func_args_str});
    }`

  stmts.push(utils.str2ast(wrapper_for_code));
    
  var params = control_vars_num > 0 ? fuel_params.concat(control_arr_var) : fuel_params;
  return {
    stmt: TsASTFunctions.createFunctionDeclaration(func_name, stmts, params),
    control: control_arr_var,
    control_num: control_nums
  }
}


//::::::::This fucntion is responsible for genarating the program tests::::::::
export function generateTests<ts_type>(program_info : IProgramInfo<ts_type>,output_dir:string, js_file:string):string{
  var fun_names = [];
  var num_fun = 0;
  var tests = [];
  var curr_test = "";
  var number_test:finder.HashTable<number> = {};
  var constant_code_str:string = "";
  var all_cases:number[][] = [];
  var cases:number[];
  var combinations;
  var create_functions = {};
  var fuels_constant_code:string = "";
  var first_needs_fuel:boolean = true;

  var classes_info = program_info.getClassesInfo();
  //Create functions generated for object recursive and non-recursive objects
  Object.keys(classes_info).forEach(function (class_name) {
    if(!program_info.hasCycle(class_name)) {
      var create_obj = generateSymbolicObjects.makeNonRecursiveCreateFunction(class_name,program_info);
      program_info.updateCreateInfo(class_name, create_obj.control_nums);
      create_functions[class_name] = create_obj;
      tests.push(create_obj.func);
      constant_code_str += utils.ast2str(create_obj.func)+"\n\n";
    }

    else {
      if(first_needs_fuel) {
        fuels_constant_code += `const fuels = require("fuels");\n\n`;
        first_needs_fuel = false;
      }
      fuels_constant_code += `var ${class_name}_fuels = fuels.${class_name};\n`;

      var recursive_create_obj = generateSymbolicObjects.makeRecursiveCreateFunction(class_name,program_info);
      program_info.updateCreateInfo(class_name, recursive_create_obj.control_nums);
      create_functions[class_name] = recursive_create_obj;
      tests.push(recursive_create_obj.func);
      constant_code_str += utils.ast2str(recursive_create_obj.func)+"\n\n";
  
      var class_constructors = program_info.getClassConstructorsInfo(class_name);
      //Saves the number of constructors of the object with cyclic that has more constructors for later use in the fuel var array
      if(program_info.getMaxConstructorsRecursiveObjects() < class_constructors.length)
        program_info.setMaxConstructorsRecursiveObjects(class_constructors.length);
    }
  });

  tests.push(utils.str2ast(constants.ENTER_STR));

  var interfaces_info = program_info.getInterfacesInfo()
  //Creation of Mock constructors and methods for interfaces
  Object.keys(interfaces_info).forEach(function (interface_name) {
    //Creation of the mock constructor for the interface
    var interface_mock_constructor = generateSymbolicInterface.createInterfaceMockConstructor(interface_name,program_info);
    constant_code_str += utils.ast2str(interface_mock_constructor.stmts)+"\n\n";

    var methods_info = program_info.getMethodsInfo();
    //Creation of the mock methods for the interface
    if(methods_info[interface_name]){
      Object.keys(methods_info[interface_name]).forEach(function (method_name) {
        var interface_method_info = methods_info[interface_name][method_name];
        var interface_mock_method = generateSymbolicFunctions.createMockFunction(interface_method_info.arg_types,interface_method_info.ret_type,program_info);
        var proto_assignment = TsASTFunctions.createPrototypeAssignment(interface_name, method_name, interface_mock_method);
        constant_code_str += utils.ast2str(proto_assignment)+"\n\n";
      });
    }
  });

  var constructors_info = program_info.getConstructorsInfo();
  //Iterates over all the object that have at least one constructor
  Object.keys(constructors_info).forEach(function (class_name) { 

    curr_test = constant_code_str+"\n";

    //Calculates the test number
    if(number_test[class_name] === undefined)
      number_test[class_name] = 1;
    else
      number_test[class_name]++;

    var comment = "Comment1Test"+constants.SPACE_STR+"of"+constants.SPACE_STR+class_name+constants.APOSTROPHE_STR+"s"+constants.SPACE_STR+"constructors"+"Comment2();";
    tests.push(utils.str2ast(comment));
    curr_test += comment+"\n";

    //Generation of the constructors tests
    var ret = generateConstructorTests(class_name, program_info, output_dir);
    tests.push(ret.stmt);
    curr_test+=utils.ast2str(ret.stmt)+"\n";

    tests.push(utils.str2ast(constants.ENTER_STR));

    //It will generate an array with the multiple options that each function will have for their switch statement(s), if they exist
    all_cases = [];
    for(var i = 0; i<ret.control.length; i++){
      cases = [];
      for (var j=0;j<ret.control_num[i];j++){
        cases.push(j+1);
      }
      all_cases.push(cases);
    }

    var constructor_call_str;
    var constructor_call;

    //Generates the combinations that will be the arguments when calling the constructor's test function
    if(all_cases.length>0){
      combinations = utils.createCombinations(all_cases);
      
      //For each combination it will generate a call to the constructor's test function
      for(var i = 0;i<combinations.length;i++){
        constructor_call_str = "test_"+class_name+"_constructors("+combinations[i]+");";
        constructor_call = utils.str2ast(constructor_call_str);
        tests.push(constructor_call);
        curr_test += "\n"+constructor_call_str;
        tests.push(utils.str2ast(constants.ENTER_STR)); 
      }
    }

    //If there is only one case it will generate the call to the constructor's test function without arguments
    else{
      constructor_call_str = "test_"+class_name+"_constructors();";
      constructor_call = utils.str2ast(constructor_call_str);
      tests.push(constructor_call);
      curr_test += "\n"+constructor_call_str;
      tests.push(utils.str2ast(constants.ENTER_STR)); 
    }

    //It will write the constructor's test in a file inside the TS file test directory
    fs.writeFileSync(output_dir+"/test_"+class_name+"_constructors.js",fuels_constant_code+"\n"+js_file+"\n\n"+utils.stringManipulation(curr_test));

    fun_names[num_fun] = constructor_call_str;
    num_fun++;
  });

  var methods_info = program_info.getMethodsInfo();
  //Iterates over all the object that have at least one method
  Object.keys(methods_info).forEach(function (class_name) { 
    var class_methods_info = program_info.getClassMethodsInfo(class_name) 
    //Iterates over all the method that an object has
    Object.keys(class_methods_info).forEach(function (method_name){

      curr_test = constant_code_str+"\n";
      
      //Calculates the test number
      if(number_test[method_name] === undefined)
        number_test[method_name]=1;
      else
        number_test[method_name]++;
      
      var comment = "Comment1Test"+constants.SPACE_STR+"of"+constants.SPACE_STR+class_name+constants.APOSTROPHE_STR+"s"+constants.SPACE_STR+"method"+constants.COLONS_STR+method_name+"Comment2();";
      tests.push(utils.str2ast(comment));
      curr_test += comment+"\n";

      //Generates the method's test function
      var rets = generateMethodTest(class_name,method_name,number_test[method_name],program_info);
      
      var methods_str = rets.map(function(ret){
        tests.push(ret.stmt);
        return utils.ast2str(ret.stmt);
      }).join("\n");
      
      curr_test += methods_str;

      tests.push(utils.str2ast(constants.ENTER_STR));

      //It will write the method's test in a file inside the TS file test directory
      fs.writeFileSync(output_dir+"/test"+number_test[method_name]+"_"+method_name+".js",fuels_constant_code+"\n"+js_file+"\n\n"+utils.stringManipulation(curr_test));
    });
  });


  var functions_info = program_info.getFunctionsInfo();
  //Functions tests will be created
  Object.keys(functions_info).forEach(function (fun_name) { 

   
    curr_test = constant_code_str+"\n";

    //Calculates the test number 
    if(number_test[fun_name] === undefined)
      number_test[fun_name]=1;
    else
      number_test[fun_name]++;

    var comment = "Comment1Test"+constants.SPACE_STR+"of"+constants.SPACE_STR+"function"+constants.COLONS_STR+fun_name+"Comment2();";
    tests.push(utils.str2ast(comment));
    curr_test += comment+"\n";

    //Generates the function's test function
    var rets = generateFunctionTest(fun_name,number_test[fun_name],program_info);

    var functions_str = rets.map(function(ret){
      tests.push(ret.stmt);
      return utils.ast2str(ret.stmt);
    }).join("\n");
    
    curr_test += functions_str;

    tests.push(utils.str2ast(constants.ENTER_STR));
   
    //It will generate an array with the multiple options that each function will have for their switch statement(s), if they exist
    /*all_cases = [];
    for(var i = 0; i<ret.control.length; i++){
      cases = [];
      for (var j=0;j<ret.control_num[i];j++){
        cases.push(j+1);
      }
      all_cases.push(cases);
    }

    var fun_call_str;
    var fun_call;
    //Generates the combinations that will be the arguments when calling the function's test function
    if(all_cases.length>0){
      combinations = utils.createCombinations(all_cases);
      //For each combination it will generate a call to the function test function
      for(var i = 0;i<combinations.length;i++){
        fun_call_str = "test"+number_test[fun_name]+"_"+fun_name+"("+combinations[i]+");";
        fun_call = utils.str2ast(fun_call_str);
        tests.push(fun_call);
        curr_test += "\n"+fun_call_str;
        tests.push(utils.str2ast(constants.ENTER_STR)); 
      }
    }

    //If there is only one case it will generate the call to the method's test function without arguments
    else{
      fun_call_str = "test"+number_test[fun_name]+"_"+fun_name+"();"
      fun_call = utils.str2ast(fun_call_str);
      tests.push(fun_call);
      curr_test += "\n"+fun_call_str;
      tests.push(utils.str2ast(constants.ENTER_STR)); 
    }
    */
    //It will write the function's test in a file inside the TS file test directory
    fs.writeFileSync(output_dir+"/test"+number_test[fun_name]+"_"+fun_name+".js",fuels_constant_code+"\n"+js_file+"\n\n"+utils.stringManipulation(curr_test));

    //fun_names[num_fun]=fun_call_str;
    num_fun++;
  });

  var test_block = TsASTFunctions.generateBlock(tests);
  var test_str = utils.ast2str(test_block);

  //Manipulation of test file string to create special characters
  var test_str_final = utils.stringManipulation(test_str);

  //returns the string with all the test functions together
  return "/*\n=====Function that will run the tests functions=====\n*/\nfunction Test() "+test_str_final+"\n\nTest();";
}