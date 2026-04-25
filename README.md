# Ney Year Resolution Bingo

## Branch Creation Rule

A ruleset for this repository defines allowed branch names. Depending on the nature of the content you will work on, a branch can either be a _feature branche_, a _bug fix branch_ or a _documentation branch_.

- Feature branch: concerns the implementation of new functionalities. The branch name shall be perfixed with `feature/<number of issue>/` where \<number of issue\> is an open issue. A feature branch shall reference an issue, which means the details of a feature shall first be formalized in a concrete issue with a clear goal and plan of execution before the creation of a branch. 
- Bug fix branch: concerns addressing known issues that creates impediment in the regular flow of the application. The branch name shall be perfixed with `bugfix/<number of issue>/` where \<number of issue\> is an open issue. A bug fix branch shall reference an issue, which means the details of the bug to fix shall first be formalized in a concrete issue with a clear goal and plan of execution before the creation of a branch. 
- Documentation branch: concerns updates of Markdown files and housekeeping, not related to major changes of the code base. The branch name shall be prefixed with `doc/<number of issue>/` where \<number of issue\> is an open issue.

In all the cases, a brief explanation of the goal you planned to achieved shall follow the prefix.

| Branch Type   | Regex                 |
|:--------------|:----------------------|
|Feature        | ^feature/[0-9]+/.*$  |
|Bug Fix        | ^bugfix/[0-9]+/.*$   |
|Documentation  | ^doc/[0-9]+/.*$      |

In principle, for easier documentation and improved history inspection, it is advise to reference concrete issues in the branch name. If for any reason you are unable to follow the procedure, use _999999_ as the issue number in the branch name.

## Commit Messages

Each commit message shall follow the following pattern:

```
^#\d+[\s-].*$
```

For instance: `#1234 Implemented XYZ` is a valid commit message related to issue 1234.

The script `githooks/commit-msg` verify the content of the commit message. Feel free to activate it to help with consistent commit messages:

```bash
cp ./githooks/commit-msg .git/hooks
# Any hook in the .git/hooks/ folder shall be executable for git to invoke it
chmod u+x .git/hooks/commit-msg
```

## Pull Requests

The default branch of this repository is the _main_ branch. The main branch is protected (i.e., no direct push are allowed).

Usually, you want to work on a separate branch and open a pull request into main as soon as you're done with it.

The pull request shall squash commits for better readability. Moreover, the title of the pull request shall contain one of the following tags:

- \[MAJOR\]
- \[MINOR\]
- \[PATCH\]
- \[NO-RELEASE\]

Based on the tag used (except \[NO-RELEASE\]), new images will be pushed to the registry with the updated version.