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

                totalRepositoriesWithContributedCommits
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

        /*
         * CODE
         *
         * Number of repositories where
         * the user contributed commits.
         *
         * This is an official GitHub
         * contribution field.
         */

        code:
            activity
                .totalRepositoriesWithContributedCommits
            || 0,


        /*
         * COMMITS
         */

        commits:
            activity
                .totalCommitContributions
            || 0,


        /*
         * PULL REQUESTS
         */

        pullRequests:
            activity
                .totalPullRequestContributions
            || 0,


        /*
         * ISSUES
         */

        issues:
            activity
                .totalIssueContributions
            || 0,


        /*
         * CODE REVIEWS
         */

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
        raw.code,
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

            code: 0,

            commits: 0,

            pullRequests: 0,

            issues: 0,

            reviews: 0
        };
    }


    return {

        code:
            Math.round(
                (raw.code / maxValue) * 100
            ),

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
   CREATE RADAR POINTS
========================================================= */

function createRadarPoints(
    percentages
) {

    const MAX_RADIUS = 135;


    /*
     * Five-axis radar positions
     *
     *                 COMMITS
     *                    |
     *                    |
     *        CODE        |       PULL REQUESTS
     *          \         |        /
     *           \        |       /
     *            \       |      /
     *             \      |     /
     *              \     |    /
     *               \    |   /
     *                \   |  /
     *                 \  | /
     *                  \ |/
     *                   \/
     *                   /\
     *                  /  \
     *                 /    \
     *                /      \
     *       REVIEWS /        \ ISSUES
     *
     */


    const positions = {

        commits: {
            x: 0,
            y: -135
        },

        pullRequests: {
            x: 128,
            y: -42
        },

        issues: {
            x: 79,
            y: 109
        },

        reviews: {
            x: -79,
            y: 109
        },

        code: {
            x: -128,
            y: -42
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


    const codeX =
        positions.code.x *
        (percentages.code / 100);

    const codeY =
        positions.code.y *
        (percentages.code / 100);


    return {

        commitsPoint:
            `${commitsX},${commitsY}`,

        pullRequestsPoint:
            `${pullRequestsX},${pullRequestsY}`,

        issuesPoint:
            `${issuesX},${issuesY}`,

        reviewsPoint:
            `${reviewsX},${reviewsY}`,

        codePoint:
            `${codeX},${codeY}`,


        commitsX,
        commitsY,

        pullRequestsX,
        pullRequestsY,

        issuesX,
        issuesY,

        reviewsX,
        reviewsY,

        codeX,
        codeY
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
        "[code]",
        `${percentages.code}%`
    );


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


    svg = svg.replaceAll(
        "{{codePoint}}",
        radar.codePoint
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


    /* =====================================================
       CODE POINT
    ===================================================== */

    svg = svg.replaceAll(
        "{{codeX}}",
        radar.codeX
    );

    svg = svg.replaceAll(
        "{{codeY}}",
        radar.codeY
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
