```javascript
const fs = require("fs");
const path = require("path");

/* =========================================================
   CONFIGURATION
========================================================= */

const GITHUB_USERNAME = "Nasrullah8586";

const GITHUB_GRAPHQL_URL =
    "https://api.github.com/graphql";

const TEMPLATE_PATH =
    path.join(__dirname, "template.svg");

const OUTPUT_DIR =
    path.join(__dirname, "..", "generated");

const OUTPUT_PATH =
    path.join(OUTPUT_DIR, "activity.svg");

const GITHUB_TOKEN =
    process.env.GITHUB_TOKEN;


/* =========================================================
   VALIDATE GITHUB TOKEN
========================================================= */

if (!GITHUB_TOKEN) {
    console.error(
        "❌ GITHUB_TOKEN is missing."
    );

    process.exit(1);
}


/* =========================================================
   LAST 12 MONTHS
========================================================= */

const today = new Date();

const fromDate = new Date(today);

fromDate.setFullYear(
    fromDate.getFullYear() - 1
);

const from =
    fromDate.toISOString();

const to =
    today.toISOString();


/* =========================================================
   GITHUB GRAPHQL QUERY
========================================================= */

const query = `
    query GetContributionActivity(
        $username: String!
        $from: DateTime!
        $to: DateTime!
    ) {
        user(login: $username) {

            contributionsCollection(
                from: $from
                to: $to
            ) {

                totalCommitContributions

                totalIssueContributions

                totalPullRequestContributions

                totalPullRequestReviewContributions
            }
        }
    }
`;


/* =========================================================
   FETCH GITHUB DATA
========================================================= */

async function getGitHubActivity() {

    const response =
        await fetch(
            GITHUB_GRAPHQL_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${GITHUB_TOKEN}`,

                    "User-Agent":
                        GITHUB_USERNAME
                },

                body: JSON.stringify({
                    query,

                    variables: {
                        username:
                            GITHUB_USERNAME,

                        from,

                        to
                    }
                })
            }
        );


    if (!response.ok) {

        throw new Error(
            `GitHub API request failed: ${response.status} ${response.statusText}`
        );
    }


    const result =
        await response.json();


    if (result.errors) {

        console.error(
            "GitHub GraphQL errors:"
        );

        console.error(
            JSON.stringify(
                result.errors,
                null,
                2
            )
        );

        throw new Error(
            "GitHub GraphQL returned an error."
        );
    }


    if (
        !result.data ||
        !result.data.user
    ) {

        throw new Error(
            "GitHub user was not found."
        );
    }


    return (
        result.data.user
            .contributionsCollection
    );
}


/* =========================================================
   GET RAW ACTIVITY VALUES
========================================================= */

function getRawActivity(
    activity
) {

    return {

        commits:
            activity
                .totalCommitContributions
            || 0,

        pullRequests:
            activity
                .totalPullRequestContributions
            || 0,

        issues:
            activity
                .totalIssueContributions
            || 0,

        reviews:
            activity
                .totalPullRequestReviewContributions
            || 0
    };
}


/* =========================================================
   NORMALIZE VALUES TO PERCENTAGE
========================================================= */

function calculatePercentages(
    raw
) {

    const values = [
        raw.commits,
        raw.pullRequests,
        raw.issues,
        raw.reviews
    ];


    /*
     * The largest activity value
     * becomes 100%.
     */

    const maxValue =
        Math.max(...values);


    /*
     * If there is no activity.
     */

    if (maxValue === 0) {

        return {

            commits: 0,

            pullRequests: 0,

            issues: 0,

            reviews: 0
        };
    }


    return {

        commits:
            Math.round(
                (raw.commits / maxValue) * 100
            ),

        pullRequests:
            Math.round(
                (raw.pullRequests / maxValue) * 100
            ),

        issues:
            Math.round(
                (raw.issues / maxValue) * 100
            ),

        reviews:
            Math.round(
                (raw.reviews / maxValue) * 100
            )
    };
}


/* =========================================================
   CREATE 4-AXIS RADAR POINTS
========================================================= */

function createRadarPoints(
    percentages
) {

    const MAX_RADIUS = 135;


    /*
     * Four-axis radar
     *
     *                    COMMITS
     *                       |
     *                       |
     *                       |
     *                       |
     *                       |
     *                       |
     *                       |
     * REVIEWS  -------------+-------------  PULL REQUESTS
     *                       |
     *                       |
     *                       |
     *                       |
     *                       |
     *                       |
     *                       |
     *                     ISSUES
     *
     */


    const positions = {

        commits: {
            x: 0,
            y: -MAX_RADIUS
        },

        pullRequests: {
            x: MAX_RADIUS,
            y: 0
        },

        issues: {
            x: 0,
            y: MAX_RADIUS
        },

        reviews: {
            x: -MAX_RADIUS,
            y: 0
        }
    };


    /* =====================================================
       SCALE EACH AXIS
    ===================================================== */

    const commitsX =
        positions.commits.x *
        (percentages.commits / 100);

    const commitsY =
        positions.commits.y *
        (percentages.commits / 100);


    const pullRequestsX =
        positions.pullRequests.x *
        (percentages.pullRequests / 100);

    const pullRequestsY =
        positions.pullRequests.y *
        (percentages.pullRequests / 100);


    const issuesX =
        positions.issues.x *
        (percentages.issues / 100);

    const issuesY =
        positions.issues.y *
        (percentages.issues / 100);


    const reviewsX =
        positions.reviews.x *
        (percentages.reviews / 100);

    const reviewsY =
        positions.reviews.y *
        (percentages.reviews / 100);


    return {

        commitsPoint:
            `${commitsX},${commitsY}`,

        pullRequestsPoint:
            `${pullRequestsX},${pullRequestsY}`,

        issuesPoint:
            `${issuesX},${issuesY}`,

        reviewsPoint:
            `${reviewsX},${reviewsY}`,


        commitsX,
        commitsY,

        pullRequestsX,
        pullRequestsY,

        issuesX,
        issuesY,

        reviewsX,
        reviewsY
    };
}


/* =========================================================
   GENERATE SVG
========================================================= */

function generateSVG(
    percentages,
    radar
) {

    let svg =
        fs.readFileSync(
            TEMPLATE_PATH,
            "utf8"
        );


    /* =====================================================
       PERCENTAGE VALUES
    ===================================================== */

    svg = svg.replaceAll(
        "[commits]",
        `${percentages.commits}%`
    );


    svg = svg.replaceAll(
        "[pullRequests]",
        `${percentages.pullRequests}%`
    );


    svg = svg.replaceAll(
        "[issues]",
        `${percentages.issues}%`
    );


    svg = svg.replaceAll(
        "[reviews]",
        `${percentages.reviews}%`
    );


    /* =====================================================
       RADAR POLYGON POINTS
    ===================================================== */

    svg = svg.replaceAll(
        "{{commitsPoint}}",
        radar.commitsPoint
    );


    svg = svg.replaceAll(
        "{{pullRequestsPoint}}",
        radar.pullRequestsPoint
    );


    svg = svg.replaceAll(
        "{{issuesPoint}}",
        radar.issuesPoint
    );


    svg = svg.replaceAll(
        "{{reviewsPoint}}",
        radar.reviewsPoint
    );


    /* =====================================================
       COMMITS POINT
    ===================================================== */

    svg = svg.replaceAll(
        "{{commitsX}}",
        radar.commitsX
    );

    svg = svg.replaceAll(
        "{{commitsY}}",
        radar.commitsY
    );


    /* =====================================================
       PULL REQUESTS POINT
    ===================================================== */

    svg = svg.replaceAll(
        "{{pullRequestsX}}",
        radar.pullRequestsX
    );

    svg = svg.replaceAll(
        "{{pullRequestsY}}",
        radar.pullRequestsY
    );


    /* =====================================================
       ISSUES POINT
    ===================================================== */

    svg = svg.replaceAll(
        "{{issuesX}}",
        radar.issuesX
    );

    svg = svg.replaceAll(
        "{{issuesY}}",
        radar.issuesY
    );


    /* =====================================================
       CODE REVIEWS POINT
    ===================================================== */

    svg = svg.replaceAll(
        "{{reviewsX}}",
        radar.reviewsX
    );

    svg = svg.replaceAll(
        "{{reviewsY}}",
        radar.reviewsY
    );


    return svg;
}


/* =========================================================
   MAIN
========================================================= */

async function main() {

    try {

        console.log(
            "🚀 GitHub Activity Generator started..."
        );


        console.log(
            `👤 User: ${GITHUB_USERNAME}`
        );


        console.log(
            "📅 Range: Last 12 months"
        );


        /* =================================================
           FETCH DATA
        ================================================= */

        const activity =
            await getGitHubActivity();


        console.log(
            "✅ GitHub activity received."
        );


        /* =================================================
           RAW VALUES
        ================================================= */

        const raw =
            getRawActivity(
                activity
            );


        console.log(
            "📊 Raw GitHub activity:"
        );


        console.log(
            JSON.stringify(
                raw,
                null,
                2
            )
        );


        /* =================================================
           PERCENTAGES
        ================================================= */

        const percentages =
            calculatePercentages(
                raw
            );


        console.log(
            "📈 Radar percentages:"
        );


        console.log(
            JSON.stringify(
                percentages,
                null,
                2
            )
        );


        /* =================================================
           RADAR COORDINATES
        ================================================= */

        const radar =
            createRadarPoints(
                percentages
            );


        /* =================================================
           GENERATE SVG
        ================================================= */

        const svg =
            generateSVG(
                percentages,
                radar
            );


        /* =================================================
           CREATE OUTPUT DIRECTORY
        ================================================= */

        fs.mkdirSync(
            OUTPUT_DIR,
            {
                recursive: true
            }
        );


        /* =================================================
           WRITE SVG
        ================================================= */

        fs.writeFileSync(
            OUTPUT_PATH,
            svg,
            "utf8"
        );


        console.log(
            `✅ SVG generated successfully: ${OUTPUT_PATH}`
        );


        console.log(
            "🎉 GitHub Activity update completed."
        );

    } catch (error) {

        console.error(
            "❌ Activity generator failed."
        );

        console.error(
            error
        );

        process.exit(1);
    }
}


/* =========================================================
   START
========================================================= */

main();
```
