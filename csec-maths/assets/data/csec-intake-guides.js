/*
 * CSEC Mathematics — intake descriptors and popover guides.
 *
 * TWO JOBS, DELIBERATELY SEPARATED
 *
 *   DESCRIPTORS  the line under a topic title, in the row itself. Plain English,
 *                no symbols, no formulas. A learner scanning 144 rows to find
 *                where their confidence drops should not have to read notation to
 *                decide. Only codes whose original descriptor carried symbols are
 *                listed here; the rest of the taxonomy's own wording already reads
 *                plainly and is left alone.
 *
 *   GUIDES       the popover behind the (i) button. This is where notation lives:
 *                the standard formula, an illustration of a rule, or a worked
 *                calculation. It must NOT restate the descriptor or merely cite
 *                the syllabus — the learner already read the descriptor, and a
 *                syllabus citation tells them nothing they can use.
 *
 * FORMAT follows the CSEC Additional Mathematics build exactly:
 *   "CODE": {"rows": [["Label", "LaTeX"], ...]}
 * Each row renders through formulaStatementLatex() as \text{Label},\;LaTeX and is
 * typeset by KaTeX. Backslashes are doubled because this is a JS string literal.
 *
 * Worked calculations are preferred to bare formulas wherever a number makes the
 * rule concrete — 759000 = 7.59×10^5 teaches standard form better than a×10^n
 * alone, so where both help, both are given.
 */
(function(){
  "use strict";

  /* Plain-English replacements for descriptors that carried notation. */
  const DESCRIPTORS = {
    "M1.1.1":  "The families numbers belong to, from counting numbers up to every number on the number line.",
    "M1.1.3":  "Squaring and cubing, the reverse operations that undo them, and powers written as fractions.",
    "M1.1.4":  "Adding, subtracting, multiplying and dividing whole numbers, fractions and decimals, taken in the correct order.",
    "M1.1.12": "Writing very large or very small numbers in a short standard form.",
    "M1.1.15": "Putting a mixed list of fractions, roots and decimals in order of size.",
    "M1.3.1":  "What a set is, how many members it has, and the language used to describe one.",
    "M1.3.2":  "The three ways of writing a set down: in words, by a rule, or by listing its members.",
    "M1.3.3":  "Sets contained inside other sets, and how many such sets there are.",
    "M1.3.4":  "Combining sets, finding what they share, and finding what is left out.",
    "M1.5.8":  "The shortcuts for multiplying, dividing and raising powers.",
    /* The original read "y∝x ⇒ y=kx; y∝1x ⇒ y=kx" — the inverse law lost its
       fraction and came out identical to the direct one, so the descriptor was
       not merely notation-heavy but wrong. */
    "M2.2.8":  "How one quantity changes as another does — either rising together, or one rising as the other falls.",
    "M2.3.14": "Sketching a curve from the completed-square form, reading off where its turning point sits.",
    "M3.4.5":  "A single number worked out from a square matrix that tells you whether it can be reversed.",

    /* The rest carried notation that had lost its structure on the way into HTML:
       "θ360×" for a fraction, "V=43π r3" for four-thirds pi r cubed, "sinθ=OH"
       for opposite over hypotenuse, "√lg" for the root of l over g. Rendered like
       that a descriptor is not merely dense, it is wrong. Each correct form now
       sits in the popover; the descriptor says what the topic is about. */
    "M1.2.9":  "Changing an amount from one currency to another, and back again, using a given rate.",
    "M1.4.3":  "Working out the curved edge of a slice of a circle, and the distance right round that slice.",
    "M1.4.5":  "The total area of every face or curved surface wrapping a solid.",
    "M1.4.6":  "The space inside a solid, for the standard shapes on the syllabus.",
    "M1.4.7":  "Linking how fast, how far and how long, including average speed over a whole journey.",
    "M1.5.4":  "Operations invented by a rule, and testing whether the order or grouping of the inputs matters.",
    "M1.5.6":  "Multiplying out brackets, and putting an expression back into brackets again.",
    "M1.5.11": "Rearranging a formula so a different letter stands alone on one side.",
    "M1.5.12": "Taking out a common factor to write an expression as a product.",
    "M1.6.1":  "Plotting horizontal, vertical and slanted straight lines from their equations.",
    "M1.6.2":  "Finding where a line crosses each axis, both by reading the graph and by algebra.",
    "M1.6.3":  "Reading answers off conversion, travel and cost graphs.",
    "M2.2.1":  "Writing an expression as a product, by common factor, by grouping, or as two brackets.",
    "M2.2.2":  "Rearranging formulas that involve powers and roots so a different letter is the subject.",
    "M2.2.4":  "Rewriting a quadratic so its turning point can be read straight off.",
    "M2.3.4":  "The shorthand for a function, for the one that undoes it, and for two applied one after another.",
    "M2.3.7":  "How the steepness of two lines tells you whether they run alongside or cross at a right angle.",
    "M2.3.10": "Applying one function to the result of another, where the order changes the answer.",
    "M2.3.11": "The function that reverses another, returning the value you started with.",
    "M2.3.12": "Putting a number into a function, its inverse, or a pair applied in turn.",
    "M2.4.3":  "Building lines and angles accurately with only a straight edge and compasses.",
    "M2.4.7":  "The rule connecting the three sides of a right-angled triangle.",
    "M2.4.8":  "The three ratios linking an angle in a right-angled triangle to two of its sides.",
    "M2.5.3":  "How a matrix is described: its rows, its columns, and the size that results.",
    "M2.5.4":  "Adding, scaling and multiplying matrices, where multiplication order changes the answer.",
    "M3.2.4":  "Curves that are not straight lines, including graphs of journeys and of speed over time.",
    "M3.3.1":  "The standing results about angles and lines drawn inside a circle.",
    "M3.3.2":  "Describing a slide across the plane by how far it moves across and up.",
    "M3.3.5":  "What must be stated for each kind of transformation before the description counts as complete.",
    "M3.3.10": "Directions written as three digits, measured clockwise from north.",
    "M3.4.1":  "Describing a point by the journey from the origin to it, and the journey between two points.",
    "M3.4.3":  "The angle a vector turns through, found from its across and up parts.",
    "M3.4.6":  "Reversing a matrix, and recognising the ones that cannot be reversed.",
    "M3.4.7":  "The standard matrices that produce a reflection, a rotation or an enlargement."
  };

  /* Popover content. Notation belongs here, not in the descriptor. */
  const GUIDES = {
    /* ── Module 1 · Number Theory and Computation ───────────────────────────── */
    "M1.1.1":  {rows:[["Natural","\\mathbb{N}=\\{1,2,3,\\dots\\}"],["Integers","\\mathbb{Z}=\\{\\dots,-2,-1,0,1,2,\\dots\\}"],["Rational","\\mathbb{Q}=\\left\\{\\tfrac{a}{b}\\;:\\;a,b\\in\\mathbb{Z},\\;b\\neq 0\\right\\}"]]},
    "M1.1.2":  {rows:[["Square numbers","1,\\;4,\\;9,\\;16,\\;25,\\;36,\\dots"],["Primes","2,\\;3,\\;5,\\;7,\\;11,\\;13,\\dots"],["Prime means","\\text{exactly two factors: }1\\text{ and itself}"]]},
    "M1.1.3":  {rows:[["Square root","\\sqrt{a}=b\\iff b^{2}=a"],["Cube root","\\sqrt[3]{a}=b\\iff b^{3}=a"],["Fractional index","a^{\\frac{m}{n}}=\\sqrt[n]{a^{m}}"]]},
    "M1.1.4":  {rows:[["Order of operations","\\text{brackets}\\to\\text{indices}\\to\\times\\;\\div\\to+\\;-"],["Worked example","2+3\\times 4^{2}=2+3\\times 16=50"],["Not left to right","2+3\\times 4\\neq 20"]]},
    "M1.1.5":  {rows:[["Fraction to decimal","\\tfrac{3}{8}=3\\div 8=0.375"],["Decimal to percentage","0.375\\times 100\\%=37.5\\%"],["Percentage to fraction","37.5\\%=\\tfrac{37.5}{100}=\\tfrac{3}{8}"]]},
    "M1.1.6":  {rows:[["Prime factors","12=2^{2}\\times 3,\\qquad 18=2\\times 3^{2}"],["H.C.F. takes the lower powers","2\\times 3=6"],["L.C.M. takes the higher powers","2^{2}\\times 3^{2}=36"]]},
    "M1.1.7":  {rows:[["Place values in base b","\\dots,\\;b^{3},\\;b^{2},\\;b^{1},\\;b^{0}"],["Base 2 to base 10","1011_{2}=8+0+2+1=11_{10}"]]},
    "M1.1.8":  {rows:[["Length","1\\,\\text{m}=100\\,\\text{cm}=1000\\,\\text{mm}"],["Mass","1\\,\\text{kg}=1000\\,\\text{g}"],["Capacity","1\\,\\text{L}=1000\\,\\text{mL}"]]},
    "M1.1.9":  {rows:[["3 significant figures","0.024619\\to 0.0246"],["2 decimal places","3.14159\\to 3.14"],["Leading zeros never count","0.00408\\text{ has 3 s.f.}"]]},
    "M1.1.10": {rows:[["Commutative","a+b=b+a,\\qquad ab=ba"],["Associative","(a+b)+c=a+(b+c)"],["Distributive","a(b+c)=ab+ac"]]},
    "M1.1.11": {rows:[["Fraction of a quantity","\\tfrac{3}{4}\\times 60=45"],["Percentage of a quantity","15\\%\\text{ of }200=\\tfrac{15}{100}\\times 200=30"]]},
    "M1.1.12": {rows:[["Standard form","a\\times 10^{n},\\qquad 1\\le a\\lt 10"],["Large number","759\\,000=7.59\\times 10^{5}"],["Small number","0.00759=7.59\\times 10^{-3}"]]},
    "M1.1.13": {rows:[["As a fraction","\\tfrac{15}{60}=\\tfrac{1}{4}"],["As a percentage","\\tfrac{15}{60}\\times 100\\%=25\\%"]]},
    "M1.1.14": {rows:[["Sharing in a ratio","60\\text{ shared }2:3\\to 24\\text{ and }36"],["Direct proportion","\\dfrac{y_{1}}{x_{1}}=\\dfrac{y_{2}}{x_{2}}"],["Unit rate","\\text{rate}=\\dfrac{\\text{quantity}}{\\text{time}}"]]},
    "M1.1.15": {rows:[["Compare as decimals","\\tfrac{3}{4}=0.75,\\quad\\sqrt{2}\\approx 1.414,\\quad\\pi\\approx 3.142"],["Ascending","0.75\\lt 1.414\\lt 3.142"]]},
    "M1.1.16": {rows:[["Common difference","u_{n}=a+(n-1)d"],["Common ratio","u_{n}=ar^{\\,n-1}"],["Example","3,\\;7,\\;11,\\;15\\;\\Rightarrow\\;u_{n}=4n-1"]]},

    /* ── Module 1 · Consumer Arithmetic ─────────────────────────────────────── */
    "M1.2.1":  {rows:[["Discount","\\text{sale price}=\\text{marked price}-\\text{discount}"],["Profit","\\text{profit}=\\text{selling price}-\\text{cost price}"],["Sales tax","\\text{tax}=\\text{rate}\\times\\text{price}"]]},
    "M1.2.2":  {rows:[["Percentage profit","\\dfrac{\\text{profit}}{\\text{cost price}}\\times 100\\%"],["Percentage loss","\\dfrac{\\text{loss}}{\\text{cost price}}\\times 100\\%"],["Worked example","\\dfrac{40}{200}\\times 100\\%=20\\%"]]},
    "M1.2.3":  {rows:[["General form","\\dfrac{\\text{change}}{\\text{original}}\\times 100\\%"],["Discount as a percentage","\\dfrac{\\text{discount}}{\\text{marked price}}\\times 100\\%"]]},
    "M1.2.4":  {rows:[["Mark-up","\\text{marked price}=\\text{cost price}+\\text{mark-up}"],["After discount","\\text{selling price}=\\text{marked price}-\\text{discount}"]]},
    "M1.2.5":  {rows:[["Hire purchase total","\\text{deposit}+(\\text{instalment}\\times\\text{number of instalments})"],["Extra paid","\\text{hire purchase total}-\\text{cash price}"]]},
    "M1.2.6":  {rows:[["Simple interest","I=\\dfrac{PRT}{100}"],["Amount owed","A=P+I"],["Worked example","P=500,\\;R=6,\\;T=2\\Rightarrow I=60"]]},
    "M1.2.7":  {rows:[["Compound amount","A=P\\left(1+\\dfrac{R}{100}\\right)^{n}"],["Interest earned","I=A-P"],["Worked example","500\\left(1.06\\right)^{2}=561.80"]]},
    "M1.2.8":  {rows:[["Appreciation","A=P\\left(1+\\dfrac{R}{100}\\right)^{n}"],["Depreciation","A=P\\left(1-\\dfrac{R}{100}\\right)^{n}"]]},
    "M1.2.9":  {rows:[["Using a rate","\\text{foreign}=\\text{local}\\times\\text{rate}"],["Reversing it","\\text{local}=\\dfrac{\\text{foreign}}{\\text{rate}}"]]},
    "M1.2.10": {rows:[["Gross pay","\\text{basic}+\\text{overtime}"],["Overtime","\\text{hours}\\times\\text{rate}\\times\\text{multiplier}"],["Net pay","\\text{gross pay}-\\text{deductions}"]]},

    /* ── Module 1 · Sets ────────────────────────────────────────────────────── */
    "M1.3.1":  {rows:[["Membership","x\\in A"],["Number of members","n(A)"],["Empty set","\\varnothing\\;\\text{or}\\;\\{\\,\\}"]]},
    "M1.3.2":  {rows:[["By listing","A=\\{1,2,3\\}"],["By a rule","A=\\{x:0\\lt x\\lt 4,\\;x\\in\\mathbb{N}\\}"]]},
    "M1.3.3":  {rows:[["Subset","A\\subseteq B"],["Number of subsets","2^{n}"],["Worked example","n=3\\Rightarrow 2^{3}=8\\text{ subsets}"]]},
    "M1.3.4":  {rows:[["Union","A\\cup B"],["Intersection","A\\cap B"],["Complement","A'"]]},
    "M1.3.5":  {rows:[["Disjoint sets","A\\cap B=\\varnothing"],["Equal sets","A=B\\iff A\\subseteq B\\text{ and }B\\subseteq A"]]},
    "M1.3.6":  {rows:[["Two-set counting rule","n(A\\cup B)=n(A)+n(B)-n(A\\cap B)"],["Region outside both","n(A\\cup B)'=n(U)-n(A\\cup B)"]]},
    "M1.3.7":  {rows:[["Start from the overlap","\\text{fill }n(A\\cap B)\\text{ first}"],["Then the rest","n(\\text{A only})=n(A)-n(A\\cap B)"]]},

    /* ── Module 1 · Measurement ─────────────────────────────────────────────── */
    "M1.4.1":  {rows:[["Area units","1\\,\\text{m}^{2}=10\\,000\\,\\text{cm}^{2}"],["Volume units","1\\,\\text{m}^{3}=1\\,000\\,000\\,\\text{cm}^{3}"]]},
    "M1.4.2":  {rows:[["Rectangle","P=2(l+w)"],["Circle circumference","C=2\\pi r"]]},
    "M1.4.3":  {rows:[["Arc length","s=\\dfrac{\\theta}{360^{\\circ}}\\times 2\\pi r"],["Sector perimeter","P=s+2r"]]},
    "M1.4.4":  {rows:[["Triangle","A=\\tfrac{1}{2}bh"],["Circle","A=\\pi r^{2}"],["Trapezium","A=\\tfrac{1}{2}(a+b)h"]]},
    "M1.4.5":  {rows:[["Cuboid","S=2(lw+lh+wh)"],["Cylinder","S=2\\pi r^{2}+2\\pi rh"],["Sphere","S=4\\pi r^{2}"]]},
    "M1.4.6":  {rows:[["Prism","V=\\text{cross-section}\\times\\text{length}"],["Cylinder","V=\\pi r^{2}h"],["Sphere","V=\\tfrac{4}{3}\\pi r^{3}"]]},
    "M1.4.7":  {rows:[["Speed","v=\\dfrac{d}{t}"],["Distance","d=vt"],["Average speed","\\dfrac{\\text{total distance}}{\\text{total time}}"]]},
    "M1.4.8":  {rows:[["Margin of error","\\pm\\tfrac{1}{2}\\times\\text{smallest unit}"],["Worked example","\\text{to the nearest cm}\\Rightarrow\\pm 0.5\\,\\text{cm}"]]},
    "M1.4.9":  {rows:[["Scale as a ratio","1:n"],["Real distance","\\text{drawing}\\times n"],["Worked example","1:50\\,000,\\;3\\,\\text{cm}\\to 1.5\\,\\text{km}"]]},
    "M1.4.10": {rows:[["Split the shape","\\text{total}=\\text{part}_{1}+\\text{part}_{2}"],["Or subtract","\\text{shaded}=\\text{whole}-\\text{cut-out}"]]},

    /* ── Module 1 · Algebra 1 ───────────────────────────────────────────────── */
    "M1.5.1":  {rows:[["Three more than a number","n+3"],["Twice a number, less five","2n-5"]]},
    "M1.5.2":  {rows:[["Two negatives multiply positive","(-3)\\times(-4)=12"],["Subtracting a negative","5-(-2)=7"]]},
    "M1.5.3":  {rows:[["Collect like terms","3a+5a-2a=6a"],["Only like terms combine","3a+2b\\text{ stays as it is}"]]},
    "M1.5.4":  {rows:[["A defined operation","a*b=a+2b"],["Worked example","3*4=3+8=11"]]},
    "M1.5.5":  {rows:[["Replace and evaluate","x=3\\Rightarrow 2x^{2}-1=17"]]},
    "M1.5.6":  {rows:[["Expanding one bracket","a(b+c)=ab+ac"],["Two brackets","(x+2)(x+3)=x^{2}+5x+6"]]},
    "M1.5.7":  {rows:[["Adding","\\dfrac{a}{b}+\\dfrac{c}{d}=\\dfrac{ad+bc}{bd}"],["Multiplying","\\dfrac{a}{b}\\times\\dfrac{c}{d}=\\dfrac{ac}{bd}"]]},
    "M1.5.8":  {rows:[["Multiplying","a^{m}\\times a^{n}=a^{m+n}"],["Dividing","a^{m}\\div a^{n}=a^{m-n}"],["Power of a power","\\left(a^{m}\\right)^{n}=a^{mn}"],["Negative index","a^{-n}=\\dfrac{1}{a^{n}}"]]},
    "M1.5.9":  {rows:[["Do the same to both sides","3x+4=19\\Rightarrow 3x=15\\Rightarrow x=5"]]},
    "M1.5.10": {rows:[["Solve as for an equation","2x+1\\lt 9\\Rightarrow x\\lt 4"],["Dividing by a negative flips it","-2x\\lt 6\\Rightarrow x\\gt -3"]]},
    "M1.5.11": {rows:[["Rearranging","A=\\pi r^{2}\\Rightarrow r=\\sqrt{\\dfrac{A}{\\pi}}"]]},
    "M1.5.12": {rows:[["Common factor","6x+9=3(2x+3)"],["Difference of two squares","a^{2}-b^{2}=(a+b)(a-b)"]]},
    "M1.5.13": {rows:[["Name the unknown","\\text{let }x=\\text{the smaller number}"],["Then form an equation","x+(x+4)=26\\Rightarrow x=11"]]},
    "M1.5.14": {rows:[["Identity holds for every value","2(x+3)\\equiv 2x+6"],["Equation holds for particular values","2x+6=10\\Rightarrow x=2"]]},

    /* ── Module 1 · Introduction to Graphs ──────────────────────────────────── */
    "M1.6.1":  {rows:[["Straight line","y=mx+c"],["Table of values","x=0,1,2\\Rightarrow y=c,\\;m+c,\\;2m+c"]]},
    "M1.6.2":  {rows:[["Cuts the y-axis","x=0\\Rightarrow y=c"],["Cuts the x-axis","y=0\\Rightarrow x=-\\dfrac{c}{m}"]]},
    "M1.6.3":  {rows:[["Read the gradient as a rate","m=\\dfrac{\\text{change in }y}{\\text{change in }x}"],["Read the intercept as a start value","c=\\text{value when }x=0"]]},

    /* ── Module 2 · Statistics 1 ────────────────────────────────────────────── */
    "M2.1.1":  {rows:[["Population","\\text{every member of the group}"],["Sample","\\text{the part actually measured}"]]},
    "M2.1.2":  {rows:[["Total from a table","n=\\sum f"],["Total of the values","\\sum fx"]]},
    "M2.1.3":  {rows:[["Pie chart angle","\\dfrac{f}{n}\\times 360^{\\circ}"],["Worked example","\\dfrac{9}{36}\\times 360^{\\circ}=90^{\\circ}"]]},
    "M2.1.4":  {rows:[["Mean","\\bar{x}=\\dfrac{\\sum x}{n}"],["Median","\\text{middle value in order}"],["Mode","\\text{most frequent value}"]]},
    "M2.1.5":  {rows:[["Extreme values pull the mean","\\text{use the median instead}"],["Categories have no mean","\\text{use the mode}"]]},
    "M2.1.6":  {rows:[["Range","\\text{largest}-\\text{smallest}"],["Interquartile range","Q_{3}-Q_{1}"]]},
    "M2.1.7":  {rows:[["Modal class","\\text{tallest bar}"],["Compare spread","\\text{wider spread}\\Rightarrow\\text{less consistent}"]]},
    "M2.1.8":  {rows:[["Standard deviation","\\sigma=\\sqrt{\\dfrac{\\sum(x-\\bar{x})^{2}}{n}}"],["Larger value means","\\text{more spread about the mean}"]]},
    "M2.1.9":  {rows:[["Proportion","\\dfrac{\\text{how many}}{\\text{total}}"],["As a percentage","\\dfrac{\\text{how many}}{\\text{total}}\\times 100\\%"]]},
    "M2.1.10": {rows:[["Probability","P(E)=\\dfrac{\\text{favourable outcomes}}{\\text{total outcomes}}"],["Complement","P(\\text{not }E)=1-P(E)"]]},
    "M2.1.11": {rows:[["Expected number","P(E)\\times\\text{number of trials}"]]},

    /* ── Module 2 · Algebra 2 ───────────────────────────────────────────────── */
    "M2.2.1":  {rows:[["Quadratic trinomial","x^{2}+5x+6=(x+2)(x+3)"],["Difference of two squares","x^{2}-9=(x+3)(x-3)"],["Grouping","ax+ay+bx+by=(a+b)(x+y)"]]},
    "M2.2.2":  {rows:[["Subject appears twice","ax=bx+c\\Rightarrow x=\\dfrac{c}{a-b}"]]},
    "M2.2.3":  {rows:[["Elimination","\\text{match a coefficient, then add or subtract}"],["Substitution","\\text{make one subject, put it into the other}"]]},
    "M2.2.4":  {rows:[["Completed square","x^{2}+bx=\\left(x+\\tfrac{b}{2}\\right)^{2}-\\left(\\tfrac{b}{2}\\right)^{2}"],["Worked example","x^{2}-8x+19=(x-4)^{2}+3"]]},
    "M2.2.5":  {rows:[["Quadratic formula","x=\\dfrac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}"],["By factorising","(x+2)(x+3)=0\\Rightarrow x=-2\\text{ or }-3"]]},
    "M2.2.6":  {rows:[["Form the equation","\\text{let }x\\text{ be the unknown}"],["Reject impossible roots","\\text{a length cannot be negative}"]]},
    "M2.2.7":  {rows:[["Substitute the linear into the quadratic","y=x+1\\text{ into }y=x^{2}"],["Then solve","x^{2}-x-1=0"]]},
    "M2.2.8":  {rows:[["Direct variation","y\\propto x\\iff y=kx"],["Inverse variation","y\\propto\\dfrac{1}{x}\\iff y=\\dfrac{k}{x}"],["Method","\\text{find }k\\text{ from the given pair, then substitute}"]]},

    /* ── Module 2 · Relations, Functions and Graphs 1 ───────────────────────── */
    "M2.3.1":  {rows:[["Ordered pair","(x,\\;y)"],["Relation","\\text{a set of ordered pairs}"]]},
    "M2.3.2":  {rows:[["One-to-one","\\text{each input, one distinct output}"],["Many-to-one","\\text{different inputs share an output}"]]},
    "M2.3.3":  {rows:[["Function rule","\\text{each input has exactly one output}"],["Vertical line test","\\text{a vertical line cuts the graph once}"]]},
    "M2.3.4":  {rows:[["Notation","f(x)=2x+1"],["Evaluating","f(3)=7"]]},
    "M2.3.5":  {rows:[["Gradient","m=\\dfrac{y_{2}-y_{1}}{x_{2}-x_{1}}"],["Worked example","\\dfrac{7-1}{4-1}=2"]]},
    "M2.3.6":  {rows:[["Gradient–intercept form","y=mx+c"],["Point–gradient form","y-y_{1}=m(x-x_{1})"]]},
    "M2.3.7":  {rows:[["Parallel","m_{1}=m_{2}"],["Perpendicular","m_{1}m_{2}=-1"]]},
    "M2.3.8":  {rows:[["Length","d=\\sqrt{(x_{2}-x_{1})^{2}+(y_{2}-y_{1})^{2}}"],["Midpoint","\\left(\\dfrac{x_{1}+x_{2}}{2},\\;\\dfrac{y_{1}+y_{2}}{2}\\right)"]]},
    "M2.3.9":  {rows:[["The solution is the crossing point","\\text{read off }(x,\\;y)"]]},
    "M2.3.10": {rows:[["Composite","fg(x)=f\\bigl(g(x)\\bigr)"],["Inner function first","\\text{apply }g\\text{, then }f"]]},
    "M2.3.11": {rows:[["Inverse undoes the function","ff^{-1}(x)=x"],["Finding it","\\text{swap }x\\text{ and }y\\text{, then make }y\\text{ the subject}"]]},
    "M2.3.12": {rows:[["Substitute the value","f(x)=x^{2}-3\\Rightarrow f(4)=13"]]},
    "M2.3.13": {rows:[["Parabola","y=ax^{2}+bx+c"],["Opens upward when","a\\gt 0"],["Line of symmetry","x=-\\dfrac{b}{2a}"]]},
    "M2.3.14": {rows:[["Completed-square form","y=a(x+h)^{2}+k"],["Turning point","(-h,\\;k)"],["Minimum when","a\\gt 0"]]},
    "M2.3.15": {rows:[["Where two graphs meet","\\text{solve them simultaneously}"],["Reading a curve","\\text{draw across, then down}"]]},

    /* ── Module 2 · Geometry and Trigonometry 1 ─────────────────────────────── */
    "M2.4.1":  {rows:[["Acute","0^{\\circ}\\lt \\theta\\lt 90^{\\circ}"],["Obtuse","90^{\\circ}\\lt \\theta\\lt 180^{\\circ}"],["Reflex","180^{\\circ}\\lt \\theta\\lt 360^{\\circ}"]]},
    "M2.4.2":  {rows:[["Measure to the nearest degree","\\pm 0.5^{\\circ}"]]},
    "M2.4.3":  {rows:[["Perpendicular bisector","\\text{equal arcs from both ends}"],["Angle bisector","\\text{equal arcs from the vertex}"]]},
    "M2.4.4":  {rows:[["Rotational symmetry of order n","\\text{fits onto itself }n\\text{ times in }360^{\\circ}"]]},
    "M2.4.5":  {rows:[["Angles on a straight line","\\text{sum}=180^{\\circ}"],["Angles at a point","\\text{sum}=360^{\\circ}"],["Triangle","\\text{sum}=180^{\\circ}"]]},
    "M2.4.6":  {rows:[["Polygon interior sum","(n-2)\\times 180^{\\circ}"],["Regular polygon exterior angle","\\dfrac{360^{\\circ}}{n}"]]},
    "M2.4.7":  {rows:[["Pythagoras","a^{2}+b^{2}=c^{2}"],["Worked example","3^{2}+4^{2}=5^{2}"]]},
    "M2.4.8":  {rows:[["Sine","\\sin\\theta=\\dfrac{\\text{opposite}}{\\text{hypotenuse}}"],["Cosine","\\cos\\theta=\\dfrac{\\text{adjacent}}{\\text{hypotenuse}}"],["Tangent","\\tan\\theta=\\dfrac{\\text{opposite}}{\\text{adjacent}}"]]},
    "M2.4.9":  {rows:[["Angle of elevation","\\text{measured up from the horizontal}"],["Angle of depression","\\text{measured down from the horizontal}"]]},
    "M2.4.10": {rows:[["Choose the ratio by what you have","\\text{opposite and hypotenuse}\\Rightarrow\\sin"],["Finding an angle","\\theta=\\tan^{-1}\\left(\\dfrac{\\text{opp}}{\\text{adj}}\\right)"]]},

    /* ── Module 2 · Vectors and Matrices 1 ──────────────────────────────────── */
    "M2.5.1":  {rows:[["Column vector","\\begin{pmatrix}x\\\\y\\end{pmatrix}"],["Equal vectors","\\text{same magnitude and direction}"]]},
    "M2.5.2":  {rows:[["Adding","\\begin{pmatrix}a\\\\b\\end{pmatrix}+\\begin{pmatrix}c\\\\d\\end{pmatrix}=\\begin{pmatrix}a+c\\\\b+d\\end{pmatrix}"],["Scalar multiple","k\\begin{pmatrix}a\\\\b\\end{pmatrix}=\\begin{pmatrix}ka\\\\kb\\end{pmatrix}"]]},
    "M2.5.3":  {rows:[["Order","\\text{rows}\\times\\text{columns}"],["Worked example","\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\text{ is }2\\times 2"]]},
    "M2.5.4":  {rows:[["Addition needs equal order","\\text{add matching entries}"],["Multiplication needs","\\text{columns of the first}=\\text{rows of the second}"]]},
    "M2.5.5":  {rows:[["Storing information","\\text{rows and columns as categories}"]]},

    /* ── Module 3 · Statistics 2 ────────────────────────────────────────────── */
    "M3.1.1":  {rows:[["Class interval","10\\!-\\!19,\\;20\\!-\\!29,\\;\\dots"],["Frequency","f=\\text{how many fall in the class}"]]},
    "M3.1.2":  {rows:[["Class midpoint","\\dfrac{\\text{lower}+\\text{upper}}{2}"],["Class width","\\text{upper bound}-\\text{lower bound}"]]},
    "M3.1.3":  {rows:[["Histogram bar height","\\text{frequency density}=\\dfrac{f}{\\text{class width}}"]]},
    "M3.1.4":  {rows:[["Estimated mean","\\bar{x}=\\dfrac{\\sum fx}{\\sum f}"],["x is the midpoint","\\text{grouped data loses the exact values}"]]},
    "M3.1.5":  {rows:[["Interquartile range","Q_{3}-Q_{1}"],["Estimated range","\\text{highest bound}-\\text{lowest bound}"]]},
    "M3.1.6":  {rows:[["Grouped standard deviation","\\sigma=\\sqrt{\\dfrac{\\sum f(x-\\bar{x})^{2}}{\\sum f}}"]]},
    "M3.1.7":  {rows:[["Plot at the upper bound","(\\text{upper bound},\\;\\text{cumulative frequency})"],["Median","\\text{read at }\\tfrac{n}{2}"],["Quartiles","\\text{read at }\\tfrac{n}{4}\\text{ and }\\tfrac{3n}{4}"]]},
    "M3.1.8":  {rows:[["Compare two groups","\\text{same average, different spread}"]]},
    "M3.1.9":  {rows:[["From an ogive","\\text{read up, then across}"],["As a percentage","\\dfrac{\\text{count}}{n}\\times 100\\%"]]},
    "M3.1.10": {rows:[["Independent events","P(A\\text{ and }B)=P(A)\\times P(B)"],["Mutually exclusive","P(A\\text{ or }B)=P(A)+P(B)"]]},
    "M3.1.11": {rows:[["A sample may mislead","\\text{small samples vary a lot}"]]},

    /* ── Module 3 · Relations, Functions and Graphs 2 ───────────────────────── */
    "M3.2.1":  {rows:[["Boundary line","y=mx+c"],["Broken line means","\\lt \\;\\text{or}\\;\\gt \\;\\text{, boundary excluded}"],["Solid line means","\\le\\;\\text{or}\\;\\ge\\;\\text{, boundary included}"]]},
    "M3.2.2":  {rows:[["Solving","3x-2\\ge 7\\Rightarrow x\\ge 3"],["Dividing by a negative flips it","-3x\\gt 9\\Rightarrow x\\lt -3"]]},
    "M3.2.3":  {rows:[["Feasible region","\\text{where every constraint holds}"],["Optimum","\\text{test each vertex in the objective}"]]},
    "M3.2.4":  {rows:[["Quadratic","y=ax^{2}+bx+c"],["Cubic","y=ax^{3}+bx^{2}+cx+d"],["Reciprocal","y=\\dfrac{a}{x}"]]},
    "M3.2.5":  {rows:[["Gradient of a chord","\\dfrac{y_{2}-y_{1}}{x_{2}-x_{1}}"],["Turning point","\\text{where the curve changes direction}"]]},
    "M3.2.6":  {rows:[["Intersections give solutions","\\text{solve the two equations together}"]]},

    /* ── Module 3 · Geometry and Trigonometry 2 ─────────────────────────────── */
    "M3.3.1":  {rows:[["Angle at the centre","\\text{twice the angle at the circumference}"],["Angle in a semicircle","90^{\\circ}"],["Cyclic quadrilateral","\\text{opposite angles sum to }180^{\\circ}"]]},
    "M3.3.2":  {rows:[["Translation vector","\\begin{pmatrix}a\\\\b\\end{pmatrix}"],["Image point","(x+a,\\;y+b)"]]},
    "M3.3.3":  {rows:[["Reflection in the x-axis","(x,\\;y)\\to(x,\\;-y)"],["Rotation of 90° about O","(x,\\;y)\\to(-y,\\;x)"],["Enlargement, scale factor k","(x,\\;y)\\to(kx,\\;ky)"]]},
    "M3.3.4":  {rows:[["Congruent image","\\text{translation, reflection, rotation}"],["Similar image","\\text{enlargement changes size only}"]]},
    "M3.3.5":  {rows:[["Reflection needs","\\text{the mirror line}"],["Rotation needs","\\text{centre, angle and direction}"],["Enlargement needs","\\text{centre and scale factor}"]]},
    "M3.3.6":  {rows:[["Order matters","\\text{apply the first, then the second}"]]},
    "M3.3.7":  {rows:[["Sine rule","\\dfrac{a}{\\sin A}=\\dfrac{b}{\\sin B}=\\dfrac{c}{\\sin C}"],["Cosine rule","a^{2}=b^{2}+c^{2}-2bc\\cos A"]]},
    "M3.3.8":  {rows:[["Two sides and the included angle","A=\\tfrac{1}{2}ab\\sin C"]]},
    "M3.3.9":  {rows:[["Segment area","\\text{sector}-\\text{triangle}"],["Sector area","\\dfrac{\\theta}{360^{\\circ}}\\times\\pi r^{2}"]]},
    "M3.3.10": {rows:[["Bearings","\\text{three figures, clockwise from north}"],["Worked example","\\text{due east}=090^{\\circ}"],["Back bearing","\\theta\\pm 180^{\\circ}"]]},

    /* ── Module 3 · Vectors and Matrices 2 ──────────────────────────────────── */
    "M3.4.1":  {rows:[["Position vector","\\overrightarrow{OA}=\\begin{pmatrix}x\\\\y\\end{pmatrix}"],["Vector between points","\\overrightarrow{AB}=\\overrightarrow{OB}-\\overrightarrow{OA}"]]},
    "M3.4.2":  {rows:[["Magnitude","\\left|\\begin{pmatrix}x\\\\y\\end{pmatrix}\\right|=\\sqrt{x^{2}+y^{2}}"],["Worked example","\\sqrt{3^{2}+4^{2}}=5"]]},
    "M3.4.3":  {rows:[["Direction","\\theta=\\tan^{-1}\\!\\left(\\dfrac{y}{x}\\right)"]]},
    "M3.4.4":  {rows:[["Parallel vectors","\\mathbf{a}=k\\mathbf{b}"],["Collinear points","\\overrightarrow{AB}=k\\,\\overrightarrow{BC}"]]},
    "M3.4.5":  {rows:[["Determinant","\\det\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}=ad-bc"],["No inverse when","ad-bc=0"]]},
    "M3.4.6":  {rows:[["Inverse","\\dfrac{1}{ad-bc}\\begin{pmatrix}d&-b\\\\-c&a\\end{pmatrix}"]]},
    "M3.4.7":  {rows:[["Reflection in the x-axis","\\begin{pmatrix}1&0\\\\0&-1\\end{pmatrix}"],["Rotation of 90° about O","\\begin{pmatrix}0&-1\\\\1&0\\end{pmatrix}"],["Enlargement, factor k","\\begin{pmatrix}k&0\\\\0&k\\end{pmatrix}"]]},
    "M3.4.8":  {rows:[["Matrix form","A\\mathbf{x}=\\mathbf{b}"],["Solution","\\mathbf{x}=A^{-1}\\mathbf{b}"]]}
  };

  globalThis.CSEC_INTAKE_DESCRIPTORS = DESCRIPTORS;
  globalThis.CSEC_INTAKE_GUIDES = GUIDES;
})();
