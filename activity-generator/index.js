
const fs = require("fs");
const path = require("path");

/* =========================================================
   CONFIGURATION
========================================================= */

const GITHUB_USERNAME = "Nasrullah8586";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const TEMPLATE_PATH = path.join(__dirname, "template.svg");
const OUTPUT_DIR = path.join(__dirname, "..", "generated");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "activity.svg");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;


/* =========================================================
   VALIDATE TOKEN
========================================================= */

if (!GITHUB_TOKEN) {
    console.error("❌ GITHUB_TOKEN is missing.");
    process.exit(1);
}


/* =========================================================
   DATE RANGE
   Last 12 months
========================================================= */

const today = new Date();

const fromDate = new Date(today);
fromDate.setFullYear(fromDate.getFullYear() - 1);

const from = fromDate.toISOString();
const to = today.toISOString();


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
                contributionCalendar {
                    totalContributions
                }
            }
        }
    }
`;


/* =========================================================
   FETCH GITHUB DATA
========================================================= */

async function getGitHubActivity() {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GITHUB_TOKEN}`,
            "User-Agent": GITHUB_USERNAME
        },

        body: JSON.stringify({
            query,

            variables: {
                username: GITHUB_USERNAME,
                from,
                to
            }
        })
    });

    if (!response.ok) {
        throw new Error(
            `GitHub API request failed: ${response.status} ${response.statusText}`
        );
    }

    const result = await response.json();

    if (result.errors) {
        console.error(result.errors);
        throw new Error("GitHub GraphQL returned an error.");
    }

    if (!result.data || !result.data.user) {
        throw new Error("GitHub user data was not found.");
    }

    return result.data.user.contributionsCollection;
}


/* =========================================================
   CALCULATE PERCENTAGES
========================================================= */

function calculatePercentages(activity) {

    const commits =
        activity.totalCommitContributions || 0;

    const issues =
        activity.totalIssueContributions || 0;

    const pullRequests =
        activity.totalPullRequestContributions || 0;

    const reviews =
        activity.totalPullRequestReviewContributions || 0;

    const totalContributions =
        activity.contributionCalendar?.totalContributions || 0;


    /*
        GitHub does not provide a direct "Code" metric.

        We derive Code activity from the remaining contribution
        activity after Issues, Pull Requests and Reviews.

        It is clamped to zero so the value can never become negative.
    */

    const code =
        Math.max(
            0,
            totalContributions -
            issues -
            pullRequests -
            reviews
        );


    /*
        Raw activity values
    */

    const rawValues = {
        commits,
        pullRequests,
        issues,
        reviews,
        code
    };


    /*
        The largest activity becomes 100%.
        Other activities are scaled relative to it.
    */

    const maxValue =
        Math.max(...Object.values(rawValues));


    if (maxValue === 0) {
        return {
            commits: 0,
            pullRequests: 0,
            issues: 0,
            reviews: 0,
            code: 0
        };
    }


    return {
        commits: Math.round((commits / maxValue) * 100),

        pullRequests:
            Math.round((pullRequests / maxValue) * 100),

        issues:
            Math.round((issues / maxValue) * 100),

        reviews:
            Math.round((reviews / maxValue) * 100),

        code:
            Math.round((code / maxValue) * 100)
    };
}


/* =========================================================
   RADAR POINTS
========================================================= */

function createRadarPoints(percentages) {

    const MAX_RADIUS = 135;


    /*
        5-axis radar coordinates

                  Commits
                    |
                    |
          Code     |     Pull Requests
             \     |     /
              \    |    /
               \   |   /
                \  |  /
                 \ | /
                  \|/
                  /\
                 /  \
                /    \
        Reviews /      \ Issues
    */


    const points = {

        commits: {
            x: 0,
            y: -MAX_RADIUS
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


    /*
        Convert percentage into distance from center.
    */

    const commitsX =
        points.commits.x *
        (percentages.commits / 100);

    const commitsY =
        points.commits.y *
        (percentages.commits / 100);


    const pullRequestsX =
        points.pullRequests.x *
        (percentages.pullRequests / 100);

    const pullRequestsY =
        points.pullRequests.y *
        (percentages.pullRequests / 100);


    const issuesX =
        points.issues.x *
        (percentages.issues / 100);

    const issuesY =
        points.issues.y *
        (percentages.issues / 100);


    const reviewsX =
        points.reviews.x *
        (percentages.reviews / 100);

    const reviewsY =
        points.reviews.y *
        (percentages.reviews / 100);


    const codeX =
        points.code.x *
        (percentages.code / 100);

    const codeY =
        points.code.y *
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
   REPLACE TEMPLATE PLACEHOLDERS
========================================================= */

function generateSVG(percentages, radar) {

    let svg = fs.readFileSync(
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

    svg = svg.replaceAll(
        "[code]",
        `${percentages.code}%`
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
       RADAR CIRCLE POSITIONS
    ===================================================== */

    svg = svg.replaceAll(
        "{{commitsX}}",
        radar.commitsX
    );

    svg = svg.replaceAll(
        "{{commitsY}}",
        radar.commitsY
    );


    svg = svg.replaceAll(
        "{{pullRequestsX}}",
        radar.pullRequestsX
    );

    svg = svg.replaceAll(
        "{{pullRequestsY}}",
        radar.pullRequestsY
    );


    svg = svg.replaceAll(
        "{{issuesX}}",
        radar.issuesX
    );

    svg = svg.replaceAll(
        "{{issuesY}}",
        radar.issuesY
    );


    svg = svg.replaceAll(
        "{{reviewsX}}",
        radar.reviewsX
    );

    svg = svg.replaceAll(
        "{{reviewsY}}",
        radar.reviewsY
    );


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

        console.log("🚀 GitHub Activity Generator started...");

        console.log(
            `📊 Fetching activity for ${GITHUB_USERNAME}...`
        );


        /* Get GitHub activity */

        const activity =
            await getGitHubActivity();


        console.log("✅ GitHub activity received.");


        /* Calculate percentages */

        const percentages =
            calculatePercentages(activity);


        console.log(
            "📈 Activity percentages:",
            percentages
        );


        /* Calculate radar coordinates */

        const radar =
            createRadarPoints(percentages);


        /* Generate SVG */

        const svg =
            generateSVG(
                percentages,
                radar
            );


        /* Create generated folder */

        fs.mkdirSync(
            OUTPUT_DIR,
            {
                recursive: true
            }
        );


        /* Save SVG */

        fs.writeFileSync(
            OUTPUT_PATH,
            svg,
            "utf8"
        );


        console.log(
            `✅ Activity SVG generated: ${OUTPUT_PATH}`
        );


    } catch (error) {

        console.error(
            "❌ Activity generator failed:"
        );

        console.error(error);

        process.exit(1);
    }
}


/* =========================================================
   RUN
========================================================= */

main();
