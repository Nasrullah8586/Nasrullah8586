const fs = require("fs");
const path = require("path");

const GITHUB_USERNAME = "Nasrullah8586";
const GITHUB_API = "https://api.github.com/graphql";

const OUTPUT_FILE = path.join(
    __dirname,
    "..",
    "generated",
    "activity.svg"
);

const TEMPLATE_FILE = path.join(
    __dirname,
    "template.svg"
);


/* =========================================================
   GITHUB GRAPHQL
========================================================= */

const QUERY = `
query($login: String!) {
    user(login: $login) {
        contributionsCollection {
            totalCommitContributions
            totalIssueContributions
            totalPullRequestContributions
            totalPullRequestReviewContributions
        }
    }
}
`;


/* =========================================================
   FETCH GITHUB ACTIVITY
========================================================= */

async function fetchGitHubActivity() {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        throw new Error("GITHUB_TOKEN is not available.");
    }

    const response = await fetch(GITHUB_API, {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },

        body: JSON.stringify({
            query: QUERY,
            variables: {
                login: GITHUB_USERNAME
            }
        })
    });

    if (!response.ok) {
        throw new Error(
            `GitHub API request failed: ${response.status}`
        );
    }

    const result = await response.json();

    if (result.errors) {
        console.error(result.errors);

        throw new Error(
            "GitHub GraphQL returned an error."
        );
    }

    return result.data.user.contributionsCollection;
}


/* =========================================================
   RAW ACTIVITY DATA
========================================================= */

function getRawActivity(data) {
    return {
        commits:
            data.totalCommitContributions || 0,

        pullRequests:
            data.totalPullRequestContributions || 0,

        issues:
            data.totalIssueContributions || 0,

        reviews:
            data.totalPullRequestReviewContributions || 0
    };
}


/* =========================================================
   ACTIVITY SCALE
========================================================= */

/*
    Instead of treating activity as a percentage of the
    total activity, every metric is compared against the
    strongest metric.

    Example:

    Commits      = 100
    Pull Requests = 40
    Issues        = 20
    Reviews       = 60

    becomes:

    Commits       = 100
    Pull Requests = 40
    Issues        = 20
    Reviews       = 60
*/


function calculateScale(activity) {
    const values = [
        activity.commits,
        activity.pullRequests,
        activity.issues,
        activity.reviews
    ];

    const maximum = Math.max(...values, 1);

    return {
        commits: activity.commits / maximum,
        pullRequests: activity.pullRequests / maximum,
        issues: activity.issues / maximum,
        reviews: activity.reviews / maximum
    };
}


/* =========================================================
   DISPLAY PERCENTAGES
========================================================= */

function calculatePercentages(activity) {
    const values = [
        activity.commits,
        activity.pullRequests,
        activity.issues,
        activity.reviews
    ];

    const maximum = Math.max(...values, 1);

    return {
        commits: Math.round(
            (activity.commits / maximum) * 100
        ),

        pullRequests: Math.round(
            (activity.pullRequests / maximum) * 100
        ),

        issues: Math.round(
            (activity.issues / maximum) * 100
        ),

        reviews: Math.round(
            (activity.reviews / maximum) * 100
        )
    };
}


/* =========================================================
   RADAR CONFIGURATION
========================================================= */

const CENTER_X = 450;
const CENTER_Y = 255;

const RADIUS = 155;


/* =========================================================
   AXIS POSITIONS
========================================================= */

/*
                 COMMITS
                    ↑
                    |
                    |
 REVIEWS ←──────────┼──────────→ PULL REQUESTS
                    |
                    |
                    ↓
                  ISSUES
*/


const AXES = {
    commits: {
        angle: -90
    },

    pullRequests: {
        angle: 0
    },

    issues: {
        angle: 90
    },

    reviews: {
        angle: 180
    }
};


/* =========================================================
   POLAR → CARTESIAN
========================================================= */

function polarToCartesian(angle, distance) {
    const radians = angle * Math.PI / 180;

    return {
        x: CENTER_X + Math.cos(radians) * distance,
        y: CENTER_Y + Math.sin(radians) * distance
    };
}


/* =========================================================
   CREATE RADAR POINTS
========================================================= */

function createRadarPoints(scale) {
    const commits = polarToCartesian(
        AXES.commits.angle,
        RADIUS * scale.commits
    );

    const pullRequests = polarToCartesian(
        AXES.pullRequests.angle,
        RADIUS * scale.pullRequests
    );

    const issues = polarToCartesian(
        AXES.issues.angle,
        RADIUS * scale.issues
    );

    const reviews = polarToCartesian(
        AXES.reviews.angle,
        RADIUS * scale.reviews
    );

    return {
        commits,
        pullRequests,
        issues,
        reviews
    };
}


/* =========================================================
   FORMAT SVG POINT
========================================================= */

function pointToString(point) {
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}


/* =========================================================
   CREATE ACTIVITY POLYGON
========================================================= */

function createActivityPolygon(points) {
    return [
        pointToString(points.commits),
        pointToString(points.pullRequests),
        pointToString(points.issues),
        pointToString(points.reviews)
    ].join(" ");
}


/* =========================================================
   CREATE DATE
========================================================= */

function getUpdatedDate() {
    return new Date().toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC"
        }
    );
}


/* =========================================================
   CREATE SVG
========================================================= */

function generateSVG(activity, percentages, points) {
    if (!fs.existsSync(TEMPLATE_FILE)) {
        throw new Error(
            `Template not found: ${TEMPLATE_FILE}`
        );
    }

    let template = fs.readFileSync(
        TEMPLATE_FILE,
        "utf8"
    );


    /* -----------------------------------------------------
       RAW VALUES
    ----------------------------------------------------- */

    template = template.replace(
        /\[commits\]/g,
        String(activity.commits)
    );

    template = template.replace(
        /\[pullRequests\]/g,
        String(activity.pullRequests)
    );

    template = template.replace(
        /\[issues\]/g,
        String(activity.issues)
    );

    template = template.replace(
        /\[reviews\]/g,
        String(activity.reviews)
    );


    /* -----------------------------------------------------
       PERCENTAGES
    ----------------------------------------------------- */

    template = template.replace(
        /\[commitsPercent\]/g,
        String(percentages.commits)
    );

    template = template.replace(
        /\[pullRequestsPercent\]/g,
        String(percentages.pullRequests)
    );

    template = template.replace(
        /\[issuesPercent\]/g,
        String(percentages.issues)
    );

    template = template.replace(
        /\[reviewsPercent\]/g,
        String(percentages.reviews)
    );


    /* -----------------------------------------------------
       RADAR POINTS
    ----------------------------------------------------- */

    template = template.replace(
        /\{\{commitsPoint\}\}/g,
        pointToString(points.commits)
    );

    template = template.replace(
        /\{\{pullRequestsPoint\}\}/g,
        pointToString(points.pullRequests)
    );

    template = template.replace(
        /\{\{issuesPoint\}\}/g,
        pointToString(points.issues)
    );

    template = template.replace(
        /\{\{reviewsPoint\}\}/g,
        pointToString(points.reviews)
    );


    /* -----------------------------------------------------
       INDIVIDUAL X / Y VALUES
    ----------------------------------------------------- */

    template = template.replace(
        /\{\{commitsX\}\}/g,
        points.commits.x.toFixed(2)
    );

    template = template.replace(
        /\{\{commitsY\}\}/g,
        points.commits.y.toFixed(2)
    );

    template = template.replace(
        /\{\{pullRequestsX\}\}/g,
        points.pullRequests.x.toFixed(2)
    );

    template = template.replace(
        /\{\{pullRequestsY\}\}/g,
        points.pullRequests.y.toFixed(2)
    );

    template = template.replace(
        /\{\{issuesX\}\}/g,
        points.issues.x.toFixed(2)
    );

    template = template.replace(
        /\{\{issuesY\}\}/g,
        points.issues.y.toFixed(2)
    );

    template = template.replace(
        /\{\{reviewsX\}\}/g,
        points.reviews.x.toFixed(2)
    );

    template = template.replace(
        /\{\{reviewsY\}\}/g,
        points.reviews.y.toFixed(2)
    );


    /* -----------------------------------------------------
       META
    ----------------------------------------------------- */

    template = template.replace(
        /\[username\]/g,
        GITHUB_USERNAME
    );

    template = template.replace(
        /\[updated\]/g,
        getUpdatedDate()
    );


    return template;
}


/* =========================================================
   VALIDATE SVG
========================================================= */

function validateSVG(svg) {
    if (!svg.trim()) {
        throw new Error(
            "Generated SVG is empty."
        );
    }

    if (!svg.includes("<svg")) {
        throw new Error(
            "Generated output does not contain a valid SVG."
        );
    }

    if (svg.includes("```")) {
        throw new Error(
            "Generated SVG contains Markdown code fences."
        );
    }

    const unresolvedPlaceholders = [
        "{{commitsPoint}}",
        "{{pullRequestsPoint}}",
        "{{issuesPoint}}",
        "{{reviewsPoint}}",
        "[commits]",
        "[pullRequests]",
        "[issues]",
        "[reviews]"
    ];

    const unresolved = unresolvedPlaceholders.filter(
        placeholder =>
            svg.includes(placeholder)
    );

    if (unresolved.length > 0) {
        throw new Error(
            `Unresolved placeholders: ${unresolved.join(", ")}`
        );
    }
}


/* =========================================================
   SAVE SVG
========================================================= */

function saveSVG(svg) {
    const outputDirectory = path.dirname(
        OUTPUT_FILE
    );

    if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(
            outputDirectory,
            {
                recursive: true
            }
        );
    }

    fs.writeFileSync(
        OUTPUT_FILE,
        svg,
        "utf8"
    );
}


/* =========================================================
   MAIN
========================================================= */

async function main() {
    console.log(
        "🚀 Generating GitHub activity..."
    );

    console.log(
        `👤 User: ${GITHUB_USERNAME}`
    );


    /* -----------------------------------------------------
       FETCH
    ----------------------------------------------------- */

    const githubData =
        await fetchGitHubActivity();


    /* -----------------------------------------------------
       RAW ACTIVITY
    ----------------------------------------------------- */

    const activity =
        getRawActivity(githubData);


    console.log(
        "📊 Activity:"
    );

    console.log(
        JSON.stringify(
            activity,
            null,
            2
        )
    );


    /* -----------------------------------------------------
       SCALE
    ----------------------------------------------------- */

    const scale =
        calculateScale(activity);


    /* -----------------------------------------------------
       PERCENTAGES
    ----------------------------------------------------- */

    const percentages =
        calculatePercentages(activity);


    /* -----------------------------------------------------
       RADAR
    ----------------------------------------------------- */

    const points =
        createRadarPoints(scale);


    /* -----------------------------------------------------
       SVG
    ----------------------------------------------------- */

    const svg =
        generateSVG(
            activity,
            percentages,
            points
        );


    /* -----------------------------------------------------
       VALIDATE
    ----------------------------------------------------- */

    validateSVG(svg);


    /* -----------------------------------------------------
       SAVE
    ----------------------------------------------------- */

    saveSVG(svg);


    console.log(
        "✅ Activity SVG generated successfully."
    );

    console.log(
        `📁 ${OUTPUT_FILE}`
    );
}


/* =========================================================
   ERROR HANDLING
========================================================= */

main().catch(error => {
    console.error(
        "❌ Failed to generate activity SVG."
    );

    console.error(
        error.message
    );

    process.exit(1);
});
