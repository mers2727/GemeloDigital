"""Phase 1 Math Engine — Pricing Elasticity Twin

Implements:
  1. Regime detection (structural-break via Chow test proxy / rolling variance)
  2. OLS and Bayesian-style estimation with configurable priors
  3. Residual bootstrap for confidence intervals
  4. Walk-forward (expanding-window) validation
  5. Per-segment artifact persistence for scenario simulation
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import Optional


# ────────────────────────────────────────────────────────────
#  Regime detection
# ────────────────────────────────────────────────────────────

def detect_regime(prices: np.ndarray, demands: np.ndarray,
                  window: int = 12, threshold: float = 2.0) -> dict:
    """Detect the most recent stable regime using rolling-variance ratio.

    Returns dict with:
      regime_start: int index where the stable regime begins
      regime_used: str description
      n_total: total observations
      n_regime: observations in the selected regime
    """
    n = len(prices)
    if n < window * 2:
        return {"regime_start": 0, "regime_used": "full_series", "n_total": n, "n_regime": n}

    log_p = np.log(prices + 1e-9)
    log_d = np.log(demands + 1e-9)
    residuals = log_d - np.polyval(np.polyfit(log_p, log_d, 1), log_p)

    roll_var = pd.Series(residuals).rolling(window).var().values
    overall_var = np.nanvar(residuals)

    # Find the latest point where variance ratio exceeds threshold → regime break
    ratio = roll_var / (overall_var + 1e-12)
    breaks = np.where(ratio > threshold)[0]

    if len(breaks) == 0:
        regime_start = 0
        label = "full_series"
    else:
        regime_start = int(breaks[-1]) + 1
        label = f"from_index_{regime_start}"

    regime_n = n - regime_start
    if regime_n < max(10, window):
        regime_start = 0
        label = "full_series_fallback"
        regime_n = n

    return {
        "regime_start": regime_start,
        "regime_used": label,
        "n_total": n,
        "n_regime": regime_n,
    }


# ────────────────────────────────────────────────────────────
#  OLS estimation (log-log)
# ────────────────────────────────────────────────────────────

def estimate_ols(prices: np.ndarray, demands: np.ndarray) -> dict:
    """Ordinary Least Squares log-log regression.
    ln(demand) = alpha + beta * ln(price) + epsilon
    Returns beta, alpha, se_beta, r_squared, residuals.
    """
    log_p = np.log(prices + 1e-9)
    log_d = np.log(demands + 1e-9)

    n = len(log_p)
    X = np.column_stack([np.ones(n), log_p])
    # OLS: beta = (X'X)^-1 X'y
    XtX_inv = np.linalg.inv(X.T @ X)
    coeffs = XtX_inv @ (X.T @ log_d)
    alpha, beta = coeffs

    fitted = X @ coeffs
    residuals = log_d - fitted
    ss_res = np.sum(residuals ** 2)
    ss_tot = np.sum((log_d - np.mean(log_d)) ** 2)
    r_squared = 1 - ss_res / (ss_tot + 1e-12)

    mse = ss_res / max(n - 2, 1)
    se_beta = np.sqrt(mse * XtX_inv[1, 1])

    return {
        "beta": float(beta),
        "alpha": float(alpha),
        "se_beta": float(se_beta),
        "r_squared": float(r_squared),
        "residuals": residuals.tolist(),
    }


# ────────────────────────────────────────────────────────────
#  Bayesian-style estimation (conjugate normal prior on beta)
# ────────────────────────────────────────────────────────────

def estimate_bayesian(prices: np.ndarray, demands: np.ndarray,
                      prior_beta: float = -1.0,
                      prior_precision: float = 0.5) -> dict:
    """Bayesian update with Normal prior on beta (log-log).

    prior: beta ~ N(prior_beta, 1/prior_precision)
    Likelihood: OLS estimates.
    Posterior: weighted combination.
    """
    ols = estimate_ols(prices, demands)
    ols_beta = ols["beta"]
    ols_precision = 1.0 / (ols["se_beta"] ** 2 + 1e-12)

    post_precision = prior_precision + ols_precision
    post_mean = (prior_precision * prior_beta + ols_precision * ols_beta) / post_precision
    post_sd = 1.0 / np.sqrt(post_precision)

    return {
        "beta": float(post_mean),
        "alpha": ols["alpha"],
        "se_beta": float(post_sd),
        "r_squared": ols["r_squared"],
        "residuals": ols["residuals"],
        "prior_beta": prior_beta,
        "prior_precision": prior_precision,
        "posterior_precision": float(post_precision),
    }


# ────────────────────────────────────────────────────────────
#  Residual bootstrap
# ────────────────────────────────────────────────────────────

def residual_bootstrap(prices: np.ndarray, demands: np.ndarray,
                       n_boot: int = 2000, method: str = "ols",
                       **bayes_kwargs) -> dict:
    """Residual bootstrap for beta confidence intervals.

    Returns bootstrap_betas, ci_90, ci_95, mean, std.
    """
    log_p = np.log(prices + 1e-9)
    log_d = np.log(demands + 1e-9)

    if method == "bayes":
        est = estimate_bayesian(prices, demands, **bayes_kwargs)
    else:
        est = estimate_ols(prices, demands)

    alpha_hat = est["alpha"]
    beta_hat = est["beta"]
    residuals = np.array(est["residuals"])

    fitted = alpha_hat + beta_hat * log_p
    betas = np.empty(n_boot)

    rng = np.random.default_rng(42)
    n = len(log_p)

    for i in range(n_boot):
        boot_resid = rng.choice(residuals, size=n, replace=True)
        boot_y = fitted + boot_resid
        X = np.column_stack([np.ones(n), log_p])
        coeffs = np.linalg.lstsq(X, boot_y, rcond=None)[0]
        betas[i] = coeffs[1]

    return {
        "bootstrap_betas": betas.tolist(),
        "ci_90": [float(np.percentile(betas, 5)), float(np.percentile(betas, 95))],
        "ci_95": [float(np.percentile(betas, 2.5)), float(np.percentile(betas, 97.5))],
        "mean": float(np.mean(betas)),
        "std": float(np.std(betas)),
        "quantiles": {
            "q05": float(np.percentile(betas, 5)),
            "q25": float(np.percentile(betas, 25)),
            "q50": float(np.percentile(betas, 50)),
            "q75": float(np.percentile(betas, 75)),
            "q95": float(np.percentile(betas, 95)),
        },
    }


# ────────────────────────────────────────────────────────────
#  Walk-forward (expanding-window) validation
# ────────────────────────────────────────────────────────────

def walk_forward_validation(prices: np.ndarray, demands: np.ndarray,
                            min_train: int = 20, step: int = 1,
                            method: str = "ols") -> dict:
    """Expanding-window walk-forward validation.

    Returns per-step MAE, MAPE, and aggregate metrics.
    """
    n = len(prices)
    if n < min_train + 2:
        return {"mae": None, "mape": None, "steps": [], "error": "Not enough data"}

    log_p = np.log(prices + 1e-9)
    log_d = np.log(demands + 1e-9)

    errors = []
    pct_errors = []

    for t in range(min_train, n - 1, step):
        # Train on [0..t], predict t+1
        train_p, train_d = log_p[:t + 1], log_d[:t + 1]
        X_train = np.column_stack([np.ones(t + 1), train_p])
        coeffs = np.linalg.lstsq(X_train, train_d, rcond=None)[0]

        pred = coeffs[0] + coeffs[1] * log_p[t + 1]
        actual = log_d[t + 1]
        err = abs(actual - pred)
        errors.append(float(err))
        pct_errors.append(float(err / (abs(actual) + 1e-12)))

    mae = float(np.mean(errors)) if errors else None
    mape = float(np.mean(pct_errors)) if pct_errors else None

    return {
        "mae": mae,
        "mape": mape,
        "n_steps": len(errors),
        "errors": errors,
    }


# ────────────────────────────────────────────────────────────
#  Full segment analysis pipeline
# ────────────────────────────────────────────────────────────

def analyze_segment(prices: np.ndarray, demands: np.ndarray,
                    method: str = "ols", price_change: float = 0.05,
                    **bayes_kwargs) -> dict:
    """Run the full Phase 1 pipeline for a single segment.

    Returns a dict with all artifacts needed for persistent twin.
    """
    prices = np.asarray(prices, dtype=float)
    demands = np.asarray(demands, dtype=float)

    # Remove NaN/Inf
    mask = np.isfinite(prices) & np.isfinite(demands) & (prices > 0) & (demands > 0)
    prices = prices[mask]
    demands = demands[mask]

    if len(prices) < 5:
        return {
            "error": "Insufficient valid data points",
            "n_valid": int(len(prices)),
        }

    # 1) Regime detection
    regime = detect_regime(prices, demands)
    start = regime["regime_start"]
    p_regime = prices[start:]
    d_regime = demands[start:]

    # 2) Estimation
    if method == "bayes":
        estimation = estimate_bayesian(p_regime, d_regime, **bayes_kwargs)
    else:
        estimation = estimate_ols(p_regime, d_regime)

    # 3) Bootstrap
    bootstrap = residual_bootstrap(p_regime, d_regime, method=method, **bayes_kwargs)

    # 4) Walk-forward validation
    validation = walk_forward_validation(p_regime, d_regime, method=method)

    # 5) Baselines & impact simulation
    baseline_price = float(np.mean(p_regime[-min(6, len(p_regime)):]))
    baseline_demand = float(np.mean(d_regime[-min(6, len(d_regime)):]))

    beta = estimation["beta"]
    # Elasticity impact: %ΔQ ≈ beta * %ΔP  (log-log)
    pct_demand_change = beta * price_change
    new_demand = baseline_demand * (1 + pct_demand_change)
    new_price = baseline_price * (1 + price_change)
    revenue_before = baseline_price * baseline_demand
    revenue_after = new_price * new_demand
    revenue_change = (revenue_after - revenue_before) / (revenue_before + 1e-12)

    return {
        "regime": regime,
        "estimation": {
            "beta": estimation["beta"],
            "alpha": estimation["alpha"],
            "se_beta": estimation["se_beta"],
            "r_squared": estimation["r_squared"],
            "method": method,
        },
        "bootstrap": {
            "ci_90": bootstrap["ci_90"],
            "ci_95": bootstrap["ci_95"],
            "mean": bootstrap["mean"],
            "std": bootstrap["std"],
            "quantiles": bootstrap["quantiles"],
        },
        "validation": validation,
        "baseline": {
            "price": baseline_price,
            "demand": baseline_demand,
            "revenue": revenue_before,
        },
        "simulation": {
            "price_change": price_change,
            "pct_demand_change": float(pct_demand_change),
            "new_price": float(new_price),
            "new_demand": float(new_demand),
            "revenue_after": float(revenue_after),
            "revenue_change_pct": float(revenue_change),
        },
    }


def simulate_scenario(model_artifacts: dict, actions: list[dict]) -> dict:
    """Simulate a scenario using persisted model artifacts.

    model_artifacts: per-segment dict from a completed analysis.
    actions: list of {"segment": str, "price_change": float}

    Returns per-segment results and aggregate impact.
    """
    results = {}
    total_rev_before = 0.0
    total_rev_after = 0.0

    for action in actions:
        seg = action["segment"]
        pc = action["price_change"]

        if seg not in model_artifacts:
            results[seg] = {"error": f"Segment '{seg}' not found in model artifacts"}
            continue

        art = model_artifacts[seg]
        if "error" in art:
            results[seg] = {"error": art["error"]}
            continue

        beta = art["estimation"]["beta"]
        base_price = art["baseline"]["price"]
        base_demand = art["baseline"]["demand"]

        pct_demand_change = beta * pc
        new_demand = base_demand * (1 + pct_demand_change)
        new_price = base_price * (1 + pc)
        rev_before = base_price * base_demand
        rev_after = new_price * new_demand
        rev_change = (rev_after - rev_before) / (rev_before + 1e-12)

        # Use bootstrap quantiles for uncertainty
        boot = art.get("bootstrap", {})
        q = boot.get("quantiles", {})
        if q:
            worst_beta = q.get("q95", beta)  # most negative for price increase
            best_beta = q.get("q05", beta)
            worst_demand_change = worst_beta * pc
            best_demand_change = best_beta * pc
        else:
            worst_demand_change = pct_demand_change
            best_demand_change = pct_demand_change

        total_rev_before += rev_before
        total_rev_after += rev_after

        results[seg] = {
            "price_change": pc,
            "baseline_price": base_price,
            "baseline_demand": base_demand,
            "beta": beta,
            "pct_demand_change": float(pct_demand_change),
            "new_price": float(new_price),
            "new_demand": float(new_demand),
            "revenue_before": float(rev_before),
            "revenue_after": float(rev_after),
            "revenue_change_pct": float(rev_change),
            "uncertainty": {
                "best_demand_change": float(best_demand_change),
                "worst_demand_change": float(worst_demand_change),
            },
        }

    total_rev_change = (
        (total_rev_after - total_rev_before) / (total_rev_before + 1e-12)
        if total_rev_before > 0 else 0.0
    )

    explanation_parts = []
    for seg, r in results.items():
        if "error" in r:
            explanation_parts.append(f"- {seg}: {r['error']}")
        else:
            direction = "increase" if r["price_change"] > 0 else "decrease"
            explanation_parts.append(
                f"- {seg}: Price {direction} of {abs(r['price_change'])*100:.1f}% → "
                f"demand change {r['pct_demand_change']*100:+.1f}%, "
                f"revenue change {r['revenue_change_pct']*100:+.1f}%"
            )

    explanation = (
        f"Scenario simulation based on stored elasticity model.\n"
        f"Total revenue impact: {total_rev_change*100:+.1f}%\n\n"
        + "\n".join(explanation_parts)
    )

    return {
        "segments": results,
        "aggregate": {
            "total_revenue_before": float(total_rev_before),
            "total_revenue_after": float(total_rev_after),
            "total_revenue_change_pct": float(total_rev_change),
        },
        "explanation": explanation,
    }
