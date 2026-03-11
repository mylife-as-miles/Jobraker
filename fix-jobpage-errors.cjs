const fs = require('fs');

let content = fs.readFileSync('src/screens/Dashboard/pages/JobPage.tsx', 'utf-8');

// 1. Export error from useToast
content = content.replace('const { info } = useToast();', 'const { info, error: toastError } = useToast();');

// 2. Change signature of fetchJobMatchInsights
content = content.replace(
  'const fetchJobMatchInsights = async (jobs: Job[], context: MatchContext): Promise<Job[]> => {',
  'const fetchJobMatchInsights = async (jobs: Job[], context: MatchContext, onError?: (err: any) => void): Promise<Job[]> => {'
);
content = content.replace(
  'console.error("fetchJobMatchInsights error:", err);',
  'console.error("fetchJobMatchInsights error:", err);\n    if (onError) onError(err);'
);

// 3. Pass onError to decorateJobs
content = content.replace(
  'async (list: Job[]) => await fetchJobMatchInsights(list, matchContext),',
  'async (list: Job[]) => await fetchJobMatchInsights(list, matchContext, (err) => {\n      toastError("Match Insights Failed", "Could not fetch AI match scores. Showing basic results.");\n    }),'
);

// 4. Update other console.error places to use toastError.
content = content.replace(
  'console.error("Failed to deduct job search credits:", deductError);',
  'console.error("Failed to deduct job search credits:", deductError);\n            toastError("Credit Deduction Failed", deductError.message);'
);

content = content.replace(
  'console.error("Failed to check credits:", checkError);',
  'console.error("Failed to check credits:", checkError);\n          toastError("Credit Check Failed", "Unable to verify credits.");'
);

content = content.replace(
  'console.error("Failed to evaluate job fit", evalErr);',
  'console.error("Failed to evaluate job fit", evalErr);\n          toastError("Job Evaluation Failed", "The AI model encountered an error evaluating this job.");'
);

content = content.replace(
  'console.error("Draft generation failed", draftErr);',
  'console.error("Draft generation failed", draftErr);\n          toastError("Draft Generation Failed", "Failed to generate custom resume/cover letter.");'
);

content = content.replace(
  'console.error("Failed to insert application records", appErr);',
  'console.error("Failed to insert application records", appErr);\n          toastError("Database Error", "Failed to record your application in the history.");'
);

content = content.replace(
  'console.error("Error deducting auto apply credits:", creditErr);',
  'console.error("Error deducting auto apply credits:", creditErr);\n          toastError("Credit Error", "Failed to deduct credits after auto-applying.");'
);

fs.writeFileSync('src/screens/Dashboard/pages/JobPage.tsx', content, 'utf-8');
console.log('Done script.');
