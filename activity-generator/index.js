const fs = require("fs");
const path = require("path");

const GITHUB_USERNAME = "Nasrullah8586";
const GITHUB_API = "https://api.github.com/graphql";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
    throw new Error(
        "GITHUB_TOKEN is not available. Make sure the GitHub Actions workflow provides GITHUB_TOKEN."
    );
}

const GITHUB_HEADERS = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${GITHUB_TOKEN}`,
    "User-Agent": GITHUB_USERNAME
};

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
   GRAPHQL QUERY FOR AVAILABLE CONTRIBUTION YEARS
========================================================= */

const YEARS_QUERY = `
query($login: String!) {
    user(login: $login) {
        contributionsCollection {
            contributionYears
        }
    }
}
`;


/* =========================================================
   CURRENT YEAR
========================================================= */

const CURRENT_YEAR = new Date().getUTCFullYear();


/* =========================================================
   FETCH AVAILABLE GITHUB YEARS
========================================================= */

async function fetchContributionYears() {
    const response = await fetch(GITHUB_API, {
        method: "POST",

        headers: GITHUB_HEADERS,

        body: JSON.stringify({
            query: YEARS_QUERY,

            variables: {
                login: GITHUB_USERNAME
            }
        })
    });

    if (!response.ok) {
        throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`
        );
    }

    const result = await response.json();

    if (result.errors) {
        throw new Error(
            result.errors
                .map(error => error.message)
                .join(", ")
        );
    }

    const years =
        result?.data?.user?.contributionsCollection?.contributionYears || [];

    return years
        .map(Number)
        .filter(year => !Number.isNaN(year))
        .filter(year => year <= CURRENT_YEAR)
        .sort((a, b) => b - a);
}


/* =========================================================
   YEAR RANGE
========================================================= */

function getYearRange(year) {
    return {
        from: `${year}-01-01T00:00:00Z`,

        to: `${year}-12-31T23:59:59Z`
    };
}


/* =========================================================
   FETCH GITHUB ACTIVITY FOR A YEAR
========================================================= */

async function fetchGitHubActivity(year) {
    const { from, to } = getYearRange(year);

    const response = await fetch(GITHUB_API, {
        method: "POST",

        headers: GITHUB_HEADERS,

        body: JSON.stringify({
            query: QUERY,

            variables: {
                login: GITHUB_USERNAME,
                from,
                to
            }
        })
    });

    if (!response.ok) {
        throw new Error(
            `GitHub API error for ${year}: ${response.status} ${response.statusText}`
        );
    }

    const result = await response.json();

    if (result.errors) {
        throw new Error(
            result.errors
                .map(error => error.message)
                .join(", ")
        );
    }

    const contributions =
        result?.data?.user?.contributionsCollection;

    if (!contributions) {
        throw new Error(
            `No contribution data found for ${year}.`
        );
    }

    return contributions;
}


/* =========================================================
   RAW ACTIVITY
========================================================= */

function getRawActivity(activity) {
    return {
        commits:
            Number(activity.totalCommitContributions) || 0,

        pullRequests:
            Number(activity.totalPullRequestContributions) || 0,

        issues:
            Number(activity.totalIssueContributions) || 0,

        reviews:
            Number(
                activity.totalPullRequestReviewContributions
            ) || 0
    };
}


/* =========================================================
   SCALE
========================================================= */

function calculateScale(activity) {
    const values = [
        activity.commits,
        activity.pullRequests,
        activity.issues,
        activity.reviews
    ];

    const maxValue = Math.max(...values);

    if (maxValue === 0) {
        return 0;
    }

    return 1 / maxValue;
}


/* =========================================================
   PERCENTAGES
========================================================= */

function calculatePercentages(activity) {
    const values = [
        activity.commits,
        activity.pullRequests,
        activity.issues,
        activity.reviews
    ];

    const total = values.reduce(
        (sum, value) => sum + value,
        0
    );

    if (total === 0) {
        return {
            commits: 0,
            pullRequests: 0,
            issues: 0,
            reviews: 0
        };
    }

    return {
        commits: Math.round(
            (activity.commits / total) * 100
        ),

        pullRequests: Math.round(
            (activity.pullRequests / total) * 100
        ),

        issues: Math.round(
            (activity.issues / total) * 100
        ),

        reviews: Math.round(
            (activity.reviews / total) * 100
        )
    };
}


/* =========================================================
   GRAPH CONFIGURATION
========================================================= */

const CENTER_X = 450;
const CENTER_Y = 255;

const RADIUS = 155;

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
   ACTIVITY POINTS
========================================================= */

function createActivityPoints(scale, activity) {
    function pointFor(value, angle) {
        const distance = value * scale * RADIUS;

        const radians =
            (angle * Math.PI) / 180;

        return {
            x:
                CENTER_X +
                Math.cos(radians) * distance,

            y:
                CENTER_Y +
                Math.sin(radians) * distance
        };
    }

    return {
        reviews: pointFor(
            activity.reviews,
            AXES.reviews.angle
        ),

        issues: pointFor(
            activity.issues,
            AXES.issues.angle
        ),

        pullRequests: pointFor(
            activity.pullRequests,
            AXES.pullRequests.angle
        ),

        commits: pointFor(
            activity.commits,
            AXES.commits.angle
        )
    };
}


/* =========================================================
   SVG GENERATOR
========================================================= */

function generateSVG(
    year,
    activity,
    percentages,
    points,
    availableYears
) {
    let svg = fs.readFileSync(
        TEMPLATE_FILE,
        "utf8"
    );


    /* =====================================================
       YEAR
    ===================================================== */

    svg = svg.replace(
        /\[year\]/g,
        String(year)
    );


    /* =====================================================
       ACTIVITY VALUES
    ===================================================== */

    svg = svg.replace(
        /\[commits\]/g,
        String(activity.commits)
    );

    svg = svg.replace(
        /\[pullRequests\]/g,
        String(activity.pullRequests)
    );

    svg = svg.replace(
        /\[issues\]/g,
        String(activity.issues)
    );

    svg = svg.replace(
        /\[reviews\]/g,
        String(activity.reviews)
    );


    /* =====================================================
       ACTIVITY PERCENTAGES
    ===================================================== */

    svg = svg.replace(
        /\[commitsPercent\]/g,
        String(percentages.commits)
    );

    svg = svg.replace(
        /\[pullRequestsPercent\]/g,
        String(percentages.pullRequests)
    );

    svg = svg.replace(
        /\[issuesPercent\]/g,
        String(percentages.issues)
    );

    svg = svg.replace(
        /\[reviewsPercent\]/g,
        String(percentages.reviews)
    );


    /* =====================================================
       GRAPH POINTS
    ===================================================== */

    svg = svg.replace(
        /\{\{commitsPoint\}\}/g,
        `${points.commits.x},${points.commits.y}`
    );

    svg = svg.replace(
        /\{\{pullRequestsPoint\}\}/g,
        `${points.pullRequests.x},${points.pullRequests.y}`
    );

    svg = svg.replace(
        /\{\{issuesPoint\}\}/g,
        `${points.issues.x},${points.issues.y}`
    );

    svg = svg.replace(
        /\{\{reviewsPoint\}\}/g,
        `${points.reviews.x},${points.reviews.y}`
    );


    /* =====================================================
       INDIVIDUAL POINT COORDINATES
    ===================================================== */

    svg = svg.replace(
        /\{\{commitsX\}\}/g,
        points.commits.x.toFixed(2)
    );

    svg = svg.replace(
        /\{\{commitsY\}\}/g,
        points.commits.y.toFixed(2)
    );

    svg = svg.replace(
        /\{\{pullRequestsX\}\}/g,
        points.pullRequests.x.toFixed(2)
    );

    svg = svg.replace(
        /\{\{pullRequestsY\}\}/g,
        points.pullRequests.y.toFixed(2)
    );

    svg = svg.replace(
        /\{\{issuesX\}\}/g,
        points.issues.x.toFixed(2)
    );

    svg = svg.replace(
        /\{\{issuesY\}\}/g,
        points.issues.y.toFixed(2)
    );

    svg = svg.replace(
        /\{\{reviewsX\}\}/g,
        points.reviews.x.toFixed(2)
    );

    svg = svg.replace(
        /\{\{reviewsY\}\}/g,
        points.reviews.y.toFixed(2)
    );


    /* =====================================================
       GRAPH AXIS LINES
    ===================================================== */

    svg = svg.replace(
        /\{\{horizontalActivityLine\}\}/g,

        `M ${points.commits.x} ${CENTER_Y}
         L ${points.issues.x} ${CENTER_Y}`
    );

    svg = svg.replace(
        /\{\{verticalActivityLine\}\}/g,

        `M ${CENTER_X} ${points.reviews.y}
         L ${CENTER_X} ${points.pullRequests.y}`
    );


    /* =====================================================
       USERNAME
    ===================================================== */

    svg = svg.replace(
        /\[username\]/g,
        GITHUB_USERNAME
    );


    /* =====================================================
       UPDATED DATE
    ===================================================== */

    svg = svg.replace(
        /\[updated\]/g,
        new Date().toISOString().slice(0, 10)
    );


    /* =====================================================
       DYNAMIC YEAR NAVIGATION
    ===================================================== */

    const visibleYears = availableYears.slice(0, 5);

    for (let index = 0; index < 5; index++) {
        const value =
            visibleYears[index] !== undefined
                ? visibleYears[index]
                : "";

        svg = svg.replace(
            new RegExp(`\\{\\{year${index}\\}\\}`, "g"),
            String(value)
        );
    }


    /* =====================================================
       REMOVE EMPTY YEAR ITEMS
    ===================================================== */

    svg = svg.replace(
        /\{\{year[0-4]\}\}/g,
        ""
    );


    return svg;
}


/* =========================================================
   SVG VALIDATION
========================================================= */

function validateSVG(svg, year) {
    const requiredPlaceholders = [
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
        "{{verticalActivityLine}}",
        "[username]",
        "[updated]"
    ];

    const missing = requiredPlaceholders.filter(
        placeholder =>
            svg.includes(placeholder)
    );

    if (missing.length > 0) {
        throw new Error(
            `Template validation failed for ${year}. Missing placeholders: ${missing.join(", ")}`
        );
    }
}


/* =========================================================
   SAVE SVG
========================================================= */

function saveSVG(svg, year) {
    fs.mkdirSync(
        GENERATED_DIRECTORY,
        {
            recursive: true
        }
    );

    const outputFile = path.join(
        GENERATED_DIRECTORY,
        `activity-${year}.svg`
    );

    fs.writeFileSync(
        outputFile,
        svg,
        "utf8"
    );

    console.log(
        `✓ Generated: activity-${year}.svg`
    );
}


/* =========================================================
   SAVE CURRENT SVG
========================================================= */

function saveCurrentSVG(svg) {
    const outputFile = path.join(
        GENERATED_DIRECTORY,
        "activity.svg"
    );

    fs.writeFileSync(
        outputFile,
        svg,
        "utf8"
    );

    console.log(
        "✓ Generated: activity.svg"
    );
}


/* =========================================================
   GENERATE ONE YEAR
========================================================= */

async function generateYear(
    year,
    availableYears
) {
    console.log(
        `\nGenerating activity for ${year}...`
    );

    const githubActivity =
        await fetchGitHubActivity(year);

    const activity =
        getRawActivity(githubActivity);

    const scale =
        calculateScale(activity);

    const percentages =
        calculatePercentages(activity);

    const points =
        createActivityPoints(
            scale,
            activity
        );

    const svg =
        generateSVG(
            year,
            activity,
            percentages,
            points,
            availableYears
        );

    validateSVG(
        svg,
        year
    );

    saveSVG(
        svg,
        year
    );

    return svg;
}


/* =========================================================
   MAIN
========================================================= */

async function main() {
    try {
        console.log(
            "=========================================="
        );

        console.log(
            " GitHub Activity Generator"
        );

        console.log(
            ` User: ${GITHUB_USERNAME}`
        );

        console.log(
            "=========================================="
        );


        /* =============================================
           DETECT ACTUAL CONTRIBUTION YEARS
        ============================================= */

        const availableYears =
            await fetchContributionYears();


        if (availableYears.length === 0) {
            throw new Error(
                "No GitHub contribution years were found."
            );
        }


        console.log(
            `\nDetected contribution years: ${availableYears.join(", ")}`
        );


        /* =============================================
           GENERATE ONLY DETECTED YEARS
        ============================================= */

        let currentSVG = null;

        for (const year of availableYears) {
            const svg =
                await generateYear(
                    year,
                    availableYears
                );

            if (year === CURRENT_YEAR) {
                currentSVG = svg;
            }
        }


        /* =============================================
           CURRENT SVG
        ============================================= */

        if (!currentSVG) {
            const latestYear =
                availableYears[0];

            const latestFile =
                path.join(
                    GENERATED_DIRECTORY,
                    `activity-${latestYear}.svg`
                );

            if (fs.existsSync(latestFile)) {
                currentSVG =
                    fs.readFileSync(
                        latestFile,
                        "utf8"
                    );
            }
        }


        if (currentSVG) {
            saveCurrentSVG(
                currentSVG
            );
        }


        console.log(
            "\n=========================================="
        );

        console.log(
            " Activity generation completed!"
        );

        console.log(
            "=========================================="
        );

    } catch (error) {
        console.error(
            "\n✗ Generation failed:"
        );

        console.error(
            error.message
        );

        process.exit(1);
    }
}


/* =========================================================
   RUN
========================================================= */

main();
