#!/bin/bash

# This script resolves merge conflicts between the credits-inquiry branch and Apex branch

# Check out the credits-inquiry branch
git checkout credits-inquiry

# Merge Apex branch into credits-inquiry
# Resolve conflicts for specified files with versions from credits-inquiry branch.
git checkout --ours firestore.rules

git checkout --ours src/firebase/non-blocking-login.ts

git checkout --ours src/context/wallet-context.tsx

# Commit the resolution
git commit -m "Resolved merge conflicts between credits-inquiry and Apex branches"