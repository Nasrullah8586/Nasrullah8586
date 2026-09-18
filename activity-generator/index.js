const fs = require("fs");
const path = require("path");

const GITHUB_USERNAME = "Nasrullah8586";
const GITHUB_API = "https://api.github.com/graphql";

const GENERATED_DIRECTORY = path.join(
    __dirname,
    "..",
    "generated"
);

const TEMPLATE_FILE = path.join(
    __dirname,
    "template.svg"
);


/* =========================================================
   YEAR CONFIGURATION
========================================================= */

const START_YEAR = 2022;

const CURRENT_YEAR = new Date().getUTCFullYear();

const YEARS = [];

for (
    let year = CURRENT_YEAR;
    year >= START_YEAR;
    year--
) {
    YEARS.push(year);
}


/* =========================================================
   GITHUB GRAPHQL
========================================================= */

const QUERY = `
query(
    $login: String!,
    $from: DateTime!,
    $to: DateTime!
) {
    user(login: $login) {
        contributionsCollection(
            from: $from,
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
   GET YEAR RANGE
========================================================= */

function getYearRange(year) {
    return {
        from: `${year}-01-01T00:00:00Z`,

        to: `${year}-12-31T23:59:59Z`
    };
}


/* =========================================================
   FETCH GITHUB ACTIVITY
========================================================= */

async function fetchGitHubActivity(year) {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        throw new Error(
            "GITHUB_TOKEN is not available."
        );
    }

    const range = getYearRange(year);

    const response = await fetch(
        GITHUB_API,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",

                Authorization:
                    `Bearer ${token}`
            },

            body: JSON.stringify({
                query: QUERY,

                variables: {
                    login: GITHUB_USERNAME,

                    from: range.from,

                    to: range.to
                }
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `GitHub API request failed for ${year}: ${response.status}`
        );
    }

    const result =
        await response.json();

    if (result.errors) {
        console.error(
            result.errors
        );

        throw new Error(
            `GitHub GraphQL returned an error for ${year}.`
        );
    }

    if (
        !result.data ||
        !result.data.user ||
        !result.data.user.contributionsCollection
    ) {
        throw new Error(
            `No contribution data found for ${year}.`
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
    Each activity is compared against the strongest
    activity of the selected year.

    Example:

    Commits       = 100
    Pull Requests = 40
    Issues        = 20
    Reviews       = 60

    Scale:

    Commits       = 1.00
    Pull Requests = 0.40
    Issues        = 0.20
    Reviews       = 0.60
*/

function calculateScale(activity) {
    const values = [
        activity.commits,
        activity.pullRequests,
        activity.issues,
        activity.reviews
    ];

    const maximum =
        Math.max(...values, 1);

    return {
        commits:
            activity.commits / maximum,

        pullRequests:
            activity.pullRequests / maximum,

        issues:
            activity.issues / maximum,

        reviews:
            activity.reviews / maximum
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

    const maximum =
        Math.max(...values, 1);

    return {
        commits:
            Math.round(
                (activity.commits / maximum) * 100
            ),

        pullRequests:
            Math.round(
                (activity.pullRequests / maximum) * 100
            ),

        issues:
            Math.round(
                (activity.issues / maximum) * 100
            ),

        reviews:
            Math.round(
                (activity.reviews / maximum) * 100
            )
    };
}


/* =========================================================
   ACTIVITY GRAPH CONFIGURATION
========================================================= */

const CENTER_X = 450;
const CENTER_Y = 255;

const RADIUS = 155;


/* =========================================================
   AXIS POSITIONS
========================================================= */

/*
                     CODE REVIEWS
                           ↑
                           |
                           |
                           |
    COMMITS ←──────────────●──────────────→ ISSUES
                           |
                           |
                           |
                           ↓
                    PULL REQUESTS
*/


const AXES = {
    reviews: {
        angle: -90
    },

    issues: {
        angle: 0
    },

    pullRequests: {
        angle: 90
    },

    commits: {
        angle: 180
    }
};


/* =========================================================
   POLAR → CARTESIAN
========================================================= */

function polarToCartesian(
    angle,
    distance
) {
    const radians =
        angle * Math.PI / 180;

    return {
        x:
            CENTER_X +
            Math.cos(radians) * distance,

        y:
            CENTER_Y +
            Math.sin(radians) * distance
    };
}


/* =========================================================
   CREATE ACTIVITY POINTS
========================================================= */

function createActivityPoints(scale) {
    const reviews =
        polarToCartesian(
            AXES.reviews.angle,
            RADIUS * scale.reviews
        );

    const issues =
        polarToCartesian(
            AXES.issues.angle,
            RADIUS * scale.issues
        );

    const pullRequests =
        polarToCartesian(
            AXES.pullRequests.angle,
            RADIUS * scale.pullRequests
        );

    const commits =
        polarToCartesian(
            AXES.commits.angle,
            RADIUS * scale.commits
        );

    return {
        reviews,
        issues,
        pullRequests,
        commits
    };
}


/* =========================================================
   FORMAT SVG POINT
========================================================= */

function pointToString(point) {
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}


/* =========================================================
   CREATE ACTIVITY LINE
========================================================= */

function createActivityLine(
    firstPoint,
    secondPoint
) {
    return [
        pointToString(firstPoint),
        pointToString(secondPoint)
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
   GENERATE SVG
========================================================= */

function generateSVG(
    year,
    activity,
    percentages,
    points
) {
    if (!fs.existsSync(TEMPLATE_FILE)) {
        throw new Error(
            `Template not found: ${TEMPLATE_FILE}`
        );
    }

    let template =
        fs.readFileSync(
            TEMPLATE_FILE,
            "utf8"
        );


    /* -----------------------------------------------------
       YEAR
    ----------------------------------------------------- */

    template = template.replace(
        /\[year\]/g,
        String(year)
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
       ACTIVITY POINTS
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
       ACTIVITY LINES
    ----------------------------------------------------- */

    const horizontalLine =
        createActivityLine(
            points.commits,
            points.issues
        );

    const verticalLine =
        createActivityLine(
            points.reviews,
            points.pullRequests
        );

    template = template.replace(
        /\{\{horizontalActivityLine\}\}/g,
        horizontalLine
    );

    template = template.replace(
        /\{\{verticalActivityLine\}\}/g,
        verticalLine
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


    /* -----------------------------------------------------
       PLACEHOLDER VALIDATION
    ----------------------------------------------------- */

    const unresolvedPlaceholders = [
        "[year]",

        "[commits]",
        "[pullRequests]",
        "[issues]",
        "[reviews]",

        "[commitsPercent]",
        "[pullRequestsPercent]",
        "[issuesPercent]",
        "[reviewsPercent]",

        "{{commitsPoint}}",
        "{{pullRequestsPoint}}",
        "{{issuesPoint}}",
        "{{reviewsPoint}}",

        "{{commitsX}}",
        "{{commitsY}}",

        "{{pullRequestsX}}",
        "{{pullRequestsY}}",

        "{{issuesX}}",
        "{{issuesY}}",

        "{{reviewsX}}",
        "{{reviewsY}}",

        "{{horizontalActivityLine}}",
        "{{verticalActivityLine}}"
    ];


    const unresolved =
        unresolvedPlaceholders.filter(
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

function saveSVG(
    svg,
    year
) {
    if (
        !fs.existsSync(
            GENERATED_DIRECTORY
        )
    ) {
        fs.mkdirSync(
            GENERATED_DIRECTORY,
            {
                recursive: true
            }
        );
    }


    const yearOutputFile =
        path.join(
            GENERATED_DIRECTORY,
            `activity-${year}.svg`
        );


    fs.writeFileSync(
        yearOutputFile,
        svg,
        "utf8"
    );


    return yearOutputFile;
}


/* =========================================================
   SAVE CURRENT ACTIVITY SVG
========================================================= */

function saveCurrentSVG(svg) {
    if (
        !fs.existsSync(
            GENERATED_DIRECTORY
        )
    ) {
        fs.mkdirSync(
            GENERATED_DIRECTORY,
            {
                recursive: true
            }
        );
    }


    const currentOutputFile =
        path.join(
            GENERATED_DIRECTORY,
            "activity.svg"
        );


    fs.writeFileSync(
        currentOutputFile,
        svg,
        "utf8"
    );


    return currentOutputFile;
}


/* =========================================================
   GENERATE ONE YEAR
========================================================= */

async function generateYear(year) {
    console.log(
        `\n📅 Processing ${year}...`
    );


    /* -----------------------------------------------------
       FETCH
    ----------------------------------------------------- */

    const githubData =
        await fetchGitHubActivity(
            year
        );


    /* -----------------------------------------------------
       RAW ACTIVITY
    ----------------------------------------------------- */

    const activity =
        getRawActivity(
            githubData
        );


    console.log(
        `📊 ${year} Activity:`
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
        calculateScale(
            activity
        );


    /* -----------------------------------------------------
       PERCENTAGES
    ----------------------------------------------------- */

    const percentages =
        calculatePercentages(
            activity
        );


    /* -----------------------------------------------------
       GRAPH POINTS
    ----------------------------------------------------- */

    const points =
        createActivityPoints(
            scale
        );


    /* -----------------------------------------------------
       SVG
    ----------------------------------------------------- */

    const svg =
        generateSVG(
            year,
            activity,
            percentages,
            points
        );


    /* -----------------------------------------------------
       VALIDATE
    ----------------------------------------------------- */

    validateSVG(
        svg
    );


    /* -----------------------------------------------------
       SAVE
    ----------------------------------------------------- */

    const outputFile =
        saveSVG(
            svg,
            year
        );


    console.log(
        `✅ ${year} SVG generated.`
    );

    console.log(
        `📁 ${outputFile}`
    );


    return {
        year,
        activity,
        svg
    };
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

    console.log(
        `📆 Years: ${YEARS.join(", ")}`
    );


    /* -----------------------------------------------------
       TEMPLATE CHECK
    ----------------------------------------------------- */

    if (!fs.existsSync(TEMPLATE_FILE)) {
        throw new Error(
            `Template not found: ${TEMPLATE_FILE}`
        );
    }


    /* -----------------------------------------------------
       GENERATED DIRECTORY
    ----------------------------------------------------- */

    if (
        !fs.existsSync(
            GENERATED_DIRECTORY
        )
    ) {
        fs.mkdirSync(
            GENERATED_DIRECTORY,
            {
                recursive: true
            }
        );
    }


    /* -----------------------------------------------------
       GENERATE ALL YEARS
    ----------------------------------------------------- */

    let currentYearSVG = null;


    for (const year of YEARS) {
        const result =
            await generateYear(
                year
            );


        if (
            year === CURRENT_YEAR
        ) {
            currentYearSVG =
                result.svg;
        }
    }


    /* -----------------------------------------------------
       SAVE CURRENT YEAR AS activity.svg
    ----------------------------------------------------- */

    if (currentYearSVG) {
        const currentOutputFile =
            saveCurrentSVG(
                currentYearSVG
            );


        console.log(
            `\n⭐ Current activity SVG:`
        );

        console.log(
            `📁 ${currentOutputFile}`
        );
    }


    /* -----------------------------------------------------
       COMPLETE
    ----------------------------------------------------- */

    console.log(
        "\n🎉 All activity SVGs generated successfully."
    );
}


/* =========================================================
   ERROR HANDLING
========================================================= */

main().catch(error => {
    console.error(
        "\n❌ Failed to generate activity SVG."
    );

    console.error(
        error.message
    );

    process.exit(1);
});
