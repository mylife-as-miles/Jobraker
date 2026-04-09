#!/bin/bash
set -e

TREE1=$(git log -1 --pretty=format:%T 80b0048)
TREE2=$(git log -1 --pretty=format:%T a8750e9)
TREE3=$(git log -1 --pretty=format:%T 2c9a4db)
TREE4=$(git log -1 --pretty=format:%T afd596c)
TREE_MERGE=$(git log -1 --pretty=format:%T HEAD)

C1=$(git commit-tree $TREE1 -p e5bc883 -m "fixes2")
C2=$(git commit-tree $TREE2 -p $C1 -m "fix: sidebar nav items, user signup with email and password, add confirm password eye icon")
C3=$(git commit-tree $TREE3 -p $C2 -m "fix: add resume missing fields, remove drag and drop")
C4=$(git commit-tree $TREE4 -p $C3 -m "fix: sign up & sign in page theme fix")
CMERGE=$(git commit-tree $TREE_MERGE -p e5bc883 -p $C4 -m "Merge branch 'fixes2' into main")

git branch -f main $CMERGE
git checkout main
echo "Done."
