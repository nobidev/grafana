#!/bin/bash

# Script to find the latest release branch for each version identifier
# Usage: ./find-latest-releases.sh 12.1.x 11.0.x 10.4.x

set -e

# Function to display usage
usage() {
    echo "Usage: $0 <version_pattern> [<version_pattern> ...]"
    echo ""
    echo "Find the latest release branch for each version pattern."
    echo ""
    echo "Examples:"
    echo "  $0 12.1.x              # Find latest release-12.1.* branch"
    echo "  $0 12.1.x 11.0.x       # Find latest for multiple versions"
    echo "  $0 12.x                # Find latest release-12.*.* branch"
    echo ""
    exit 1
}

# Check if at least one argument is provided
if [ $# -eq 0 ]; then
    usage
fi

# Function to find the latest release branch for a version pattern
find_latest_release() {
    local pattern=$1

    # Convert version pattern to regex (e.g., "12.1.x" -> "12\.1\.[0-9]+")
    # Handle patterns like:
    # - 12.1.x -> release-12.1.*
    # - 12.x -> release-12.*.*
    # - 12.x.x -> release-12.*.*

    local regex_pattern

    # Normalize pattern: if only one 'x', convert to x.x (e.g., "11.x" -> "11.x.x")
    local dot_count=$(echo "$pattern" | tr -cd '.' | wc -c | tr -d ' ')
    if [ "$dot_count" -eq 1 ] && [[ "$pattern" == *.x ]]; then
        pattern="${pattern}.x"
    fi

    # Replace 'x' with regex pattern for numbers
    regex_pattern=$(echo "$pattern" | sed 's/x/[0-9]+/g')

    # Escape dots for regex
    regex_pattern=$(echo "$regex_pattern" | sed 's/\./\\./g')

    # Build the full pattern for release branches
    local full_pattern="^[[:space:]]*origin/release-${regex_pattern}\$"

    # Fetch remote branches and filter
    local branches=$(git branch -r | grep -E "$full_pattern" | sed 's/^[[:space:]]*origin\/release-//' | sed 's/[[:space:]]*$//')

    if [ -z "$branches" ]; then
        echo "No release branches found matching pattern: $pattern"
        return 1
    fi

    # Sort versions using sort -V (version sort) and get the last one (latest)
    local latest=$(echo "$branches" | sort -V | tail -n 1)

    echo "release-$latest"
}

# Process each version pattern provided as argument
for version_pattern in "$@"; do
    echo "Finding latest release for: $version_pattern"
    find_latest_release "$version_pattern"
    echo ""
done
