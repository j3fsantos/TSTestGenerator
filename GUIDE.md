# TSTestGenerator

COMPILING:
- To compile the TSTestGenerator the user needs to be in the directory of main.ts and do "tsc main.ts" 
this will compile the main.ts and the rest of the files used by it.

CREATING SYMBOLIC TESTS:
- After having the files compiled, if the user wants to only generate the tests still with the symbolic 
variables he will have to do "node main.js <input file>" (keep in mind that the input file needs to be in 
the same directory as the other files) this will generate a folder named "Test_<input file without extension>"
in this folder we can find the symbolic test for the constructors/methods/functions of the input file.

GENERATING, RUNNING AND REPLACING THE VALUES OF THE TESTS:
- If the user wants to generate the symbolic tests, run JaVerT to find which values will fail and have 
tests with the symbolic variables replaced by concrete values that will lead to an error when running
the user must have the input file in the TSTestGenerator/ directory and be in the JaVerT/environment/ 
directory after that being done the command is "./generateRunTests.sh  <input file>" this will 
generate a folder named "Test_<input file without extension>" which will have the symbolic tests
and two folders one being the concrete tests (files with the symbolic variables replaced) and the other 
being the failing models (values that given to a variable will make the program fail).

CLEANING:
- If after doing the testing the user wants to clean the directory he just has to do "./cleanTests.sh"
in the JaVerT/environment/ directory and it will clean what was generated by the TSTestGenerator and
JaVerT.