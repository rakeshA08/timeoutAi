const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');

async function pushToGitHub() {
  const token = process.argv[2] || process.env.GITHUB_TOKEN;

  if (!token) {
    console.error('\n❌ ERROR: GitHub Personal Access Token is required.');
    console.log('\nUsage:');
    console.log('  node push.js <YOUR_GITHUB_TOKEN>');
    console.log('\nHow to generate a token in 30 seconds:');
    console.log('  1. Go to: https://github.com/settings/tokens');
    console.log('  2. Click "Generate new token (classic)"');
    console.log('  3. Select the "repo" checkbox and click "Generate token"');
    console.log('  4. Copy the token and run: node push.js ghp_yourTokenHere\n');
    process.exit(1);
  }

  console.log('🚀 Pushing project to https://github.com/rakeshA08/timeoutAi.git on branch main...');

  try {
    const pushResult = await git.push({
      fs,
      http,
      dir: process.cwd(),
      url: 'https://github.com/rakeshA08/timeoutAi.git',
      ref: 'main',
      remote: 'origin',
      onAuth: () => ({
        username: token,
      }),
    });

    console.log('\n✅ SUCCESS! All files and commits have been pushed to GitHub.');
    console.log('🔗 View your repository: https://github.com/rakeshA08/timeoutAi\n');
  } catch (error) {
    console.error('\n❌ Push failed:', error.message);
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('👉 Please make sure your token has the "repo" scope checked.');
    }
  }
}

pushToGitHub();
