// Test connection on page load
const backendHost = location.hostname || 'localhost';
const backendPort = '3000';
const backendBase = `http://${backendHost}:${backendPort}`;

window.addEventListener("load", async () => {
    try {
        const res = await fetch(`${backendBase}/test`);
        const data = await res.json();
        console.log("✅ Backend connected:", data.message);
    } catch (err) {
        console.error("❌ Cannot connect to backend:", err.message);
        document.getElementById("result").innerHTML = `<p style="color:red;">Cannot connect to backend on http://localhost:3000</p>`;
    }
});

// Theme persistence
function toggleTheme() {
    document.body.classList.toggle("dark");
    localStorage.setItem("theme", document.body.classList.contains("dark"));
}

function updatePotSizeLabel() {
    const slider = document.getElementById("potSize");
    const label = document.getElementById("potSizeLabel");
    if (!slider || !label) return;

    const value = Number(slider.value);
    const labels = ["Small", "Medium", "Large"];
    label.textContent = labels[value - 1] || "Medium";
}

if (localStorage.getItem("theme") === "true") {
    document.body.classList.add("dark");
}

window.addEventListener("load", () => {
    updatePotSizeLabel();
    document.getElementById("potSize")?.addEventListener("input", updatePotSizeLabel);
});

function previewImage() {
    const file = document.getElementById("imageInput").files[0];
    const img = document.getElementById("preview");
    if (file) {
        img.src = URL.createObjectURL(file);
        img.style.display = "block";
    }
}

function animateLoading() {
    let width = 0;
    const bar = document.getElementById("barFill");
    bar.style.width = "0%";

    return setInterval(() => {
        width += 10;
        bar.style.width = width + "%";
        if (width >= 100) clearInterval(this);
    }, 200);
}

function saveFavorite() {
    const h2 = document.querySelector("#result h2");
    if (!h2) return;
    const plant = h2.innerText;
    let favs = JSON.parse(localStorage.getItem("favs")) || [];
    if (!favs.includes(plant)) favs.push(plant);
    localStorage.setItem("favs", JSON.stringify(favs));
    loadFavorites();
}

function loadFavorites() {
    const favs = JSON.parse(localStorage.getItem("favs")) || [];
    document.getElementById("favorites").innerHTML = favs.map(f => `<p>⭐ ${f}</p>`).join("");
}

window.addEventListener('load', loadFavorites);

function detectColor(file) {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
        const canvas = document.getElementById("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let r=0,g=0,b=0;

        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i+1];
            b += data[i+2];
        }

        const total = data.length / 4;
        r/=total; g/=total; b/=total;

        // Improved color detection: use dominant channel with simple thresholds
        let color = "Unknown";
        const max = Math.max(r, g, b);
        // Ignore very dark/low-saturation images
        const min = Math.min(r, g, b);
        const sat = (max - min) / (max || 1);

        if (max === g && g > r + 8 && g > b + 8 && sat > 0.08) {
            color = "Green";
        } else if (g >= r && g > b && sat > 0.03) {
            // mostly greenish
            color = "Green";
        } else if (r > g && g > b && r > 80) {
            // warm / yellowish tones (red>green>blue)
            color = "Yellow";
        } else if (r > g && r > b) {
            // reddish / brownish
            color = "Brown";
        }

        document.getElementById("leafColor").innerText = "Leaf Color: " + color;
    };
}

function updateDashboard(data) {
    if (!data || !data.length) {
        document.getElementById("dashboard").innerHTML = "";
        return;
    }
    const total = data.length;
    const avg = data.reduce((a,b)=>a+Number(b.water),0)/total;
    document.getElementById("dashboard").innerHTML = `\n+        Plants: ${total}<br>\n+        Avg Water: ${avg.toFixed(2)} L\n+    `;
}

async function uploadPlant() {
    try {
        console.log("BUTTON CLICKED");
        const file = document.getElementById("imageInput").files[0];
        console.log("FILE:", file);
        if (!file) {
            alert("Please select an image");
            return;
        }

        const resultBox = document.getElementById("result");
        resultBox.innerHTML = "<p>Loading...</p>";

        // Use a Promise wrapper for geolocation with a sensible fallback so
        // denying location doesn't silently stop the function.
        const getPosition = (timeout = 10000) => new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.warn("Geolocation not supported — using default location");
                resolve({ coords: { latitude: 40.7128, longitude: -74.0060 } });
                return;
            }

            let settled = false;
            const onSuccess = (pos) => { if (!settled) { settled = true; resolve(pos); } };
            const onError = (err) => { if (!settled) { settled = true; console.warn("Geolocation failed:", err.message); resolve({ coords: { latitude: 40.7128, longitude: -74.0060 } }); } };

            navigator.geolocation.getCurrentPosition(onSuccess, onError, { enableHighAccuracy: false, timeout });

            // Extra timeout guard
            setTimeout(() => {
                if (!settled) {
                    settled = true;
                    console.warn("Geolocation timed out — using default location");
                    resolve({ coords: { latitude: 40.7128, longitude: -74.0060 } });
                }
            }, timeout + 1000);
        });

        const position = await getPosition();
        // show loading animation
        document.getElementById("loading").style.display = "block";
        let loadingInterval = null;
        loadingInterval = animateLoading();
        detectColor(file);

        try {
            const formData = new FormData();
            formData.append("image", file);
            formData.append("lat", position.coords.latitude);
            formData.append("lon", position.coords.longitude);

            console.log("Sending to backend with location:", position.coords);
            console.log("Sending request...");

            const res = await fetch(`${backendBase}/identify`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const data = await res.json();
            console.log("Response from backend:", data);

            if (data.error) {
                resultBox.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`;
                clearInterval(loadingInterval);
                document.getElementById("loading").style.display = "none";
                document.getElementById('barFill').style.width = '0%';
                return;
            }

            // normalize fields (support old and new backend keys)
            const plant = data.plant || data.plantName || "Unknown";
            const temperature = data.temperature ?? data.temp ?? "--";
            const humidity = data.humidity ?? "--";
            const rain = data.rainChance ?? data.rain ?? "--";
            const origWater = Number(data.water ?? NaN);
            const status = data.status || "";
            const color =
                status === "Needs more water" ? "orange" :
                status === "Do not water" ? "red" : "green";
            const message = data.message || "";

            // apply pot size and environment adjustments on the client
            const potValue = Number(document.getElementById('potSize').value || 2);
            const potFactor = potValue === 1 ? 0.8 : potValue === 2 ? 1 : 1.25;
            const envVal = document.getElementById('env').value || 'Indoor';
            const envFactor = envVal === 'Outdoor' ? 1.2 : 0.8;
            const adjustedWater = isNaN(origWater) ? "--" : Number((origWater * potFactor * envFactor).toFixed(2));

            // update gauge
            if (!isNaN(adjustedWater)) {
                const percent = Math.min(100, adjustedWater * 50);
                const gauge = document.getElementById('gaugeFill');
                gauge.style.width = percent + '%';
                gauge.style.background = color;
            }

            resultBox.innerHTML = `
                <h2>${plant}</h2>
                <p>🌡 Temp: ${temperature}°C</p>
                <p>💧 Humidity: ${humidity}%</p>
                <p>🌧 Rain: ${rain}${typeof rain === 'number' ? ' mm' : ''}</p>
                <p style="color:${color}">🌿 Status: ${status}</p>
                <p>💬 ${message}</p>
                <h3>💦 Water Needed: ${isNaN(adjustedWater) ? data.water : adjustedWater} Liters</h3>
            `;

            // stop loading animation
            clearInterval(loadingInterval);
            document.getElementById("loading").style.display = "none";
            document.getElementById('barFill').style.width = '0%';
        } catch (err) {
            console.error("Upload error:", err);
            if (loadingInterval) clearInterval(loadingInterval);
            document.getElementById("loading").style.display = "none";
            document.getElementById('barFill').style.width = '0%';
            resultBox.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
        }
    } catch (err) {
        console.error("Error:", err);
        const resultBox = document.getElementById("result");
        if (resultBox) {
            resultBox.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
        }
    }
}

function closeHistory() {
        const historyDiv = document.getElementById("history");
        if (!historyDiv) return;
        historyDiv.innerHTML = "";
        historyDiv.style.display = "none";
}

async function loadHistory() {
        const historyDiv = document.getElementById("history");
        if (!historyDiv) return;

        if (historyDiv.style.display === "block" && historyDiv.innerHTML.trim() !== "") {
                closeHistory();
                return;
        }

        historyDiv.style.display = "block";
        historyDiv.innerHTML = "<p>Loading history...</p>";

        try {
                const res = await fetch(`${backendBase}/history`);
                const data = await res.json();

                const header = `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.2); margin-bottom:10px;">
                        <strong style="font-size:16px;">Scan History</strong>
                        <button type="button" onclick="closeHistory()" style="background:#fff;color:#333;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;">Close</button>
                    </div>
                `;

                if (!data || !data.length) {
                    historyDiv.innerHTML = header + "<p>No scan history yet.</p>";
                    updateDashboard(data);
                    return;
                }

                updateDashboard(data);

                historyDiv.innerHTML = header + data
                        .map(item => `
                            <div style="text-align:left; margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.12); border-radius: 10px;">
                                <strong>🌱 ${item.plant}</strong><br>
                                💧 ${item.water} L | 🌡 ${item.temperature}°C | 💦 ${item.humidity}% | 🌧 ${item.rainChance} mm<br>
                                🗓 ${new Date(item.date).toLocaleString()}
                            </div>
                        `)
                        .join("");
        } catch (err) {
                historyDiv.innerHTML = "<p style='color:red;'>Unable to load history.</p>";
                console.error(err);
        }
}