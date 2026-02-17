#!/bin/bash

# Script to set up git identity for mylife-as-miles
# Run this script whenever you want to ensure commits are made as mylife-as-miles

echo "Setting up git identity for mylife-as-miles..."

# Set local git configuration for this repository
git config --local user.name "mylife-as-miles"
git config --local user.email "mylife-as-miles@users.noreply.github.com"

echo "Git identity set successfully!"
echo "Author: $(git config --local user.name)"
echo "Email: $(git config --local user.email)"

# Verify configuration
echo ""
echo "Current local git configuration:"
git config --local --list | grep user