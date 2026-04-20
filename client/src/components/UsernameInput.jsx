'use client'

import { useForm } from 'react-hook-form'
import { useState } from 'react'

export default function UsernameInput({ onSubmit }) {
    const [focused, setFocused] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm()

    function onValid(data) {
        onSubmit(data.username)
    }

    return (
        <form
            onSubmit={handleSubmit(onValid)}
            className="username-form"
            noValidate
        >
            {}
            <div
                className="input-wrap"
                style={{
                    borderColor: focused
                        ? 'var(--border-focus)'
                        : errors.username
                            ? 'var(--bad)'
                            : 'var(--border)',
                }}
            >
                {}
                <div className="input-prefix font-mono">github.com/</div>

                <input
                    type="text"
                    placeholder="your-username"
                    autoComplete="off"
                    autoCapitalize="off"
                    className="username-input font-mono"
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    {...register('username', {
                        required: 'GitHub username is required',
                        minLength: { value: 1, message: 'Too short' },
                        maxLength: { value: 39, message: 'GitHub usernames max 39 chars' },
                        pattern: {
                            value: /^[a-zA-Z0-9-]+$/,
                            message: 'Only letters, numbers, hyphens allowed',
                        },
                    })}
                />
            </div>

            {}
            {errors.username && (
                <p className="input-error font-mono animate-fadeUp">
                    ⚠ {errors.username.message}
                </p>
            )}

            {}
            <button type="submit" className="btn btn-primary roast-btn">
                🔥 Roast My GitHub
            </button>

            <style jsx>{`
        .username-form {
          display:        flex;
          flex-direction: column;
          gap:            10px;
          width:          100%;
          max-width:      460px;
        }
        .input-wrap {
          display:       flex;
          border:        1px solid var(--border);
          border-radius: var(--radius-md);
          overflow:      hidden;
          background:    var(--bg-card);
          transition:    border-color 0.2s;
        }
        .input-prefix {
          padding:          0 14px;
          display:          flex;
          align-items:      center;
          background:       var(--bg-input);
          border-right:     1px solid var(--border);
          color:            var(--text-muted);
          font-size:        13px;
          flex-shrink:      0;
          white-space:      nowrap;
        }
        .username-input {
          flex:       1;
          background: transparent;
          border:     none;
          padding:    14px;
          color:      var(--text-primary);
          font-size:  15px;
          outline:    none;
          min-width:  0;
        }
        .username-input::placeholder { color: var(--text-muted); }
        .input-error {
          color:     var(--bad);
          font-size: 12px;
          padding:   0 4px;
        }
        .roast-btn {
          width:          100%;
          padding:        14px;
          font-size:      16px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          border-radius:  var(--radius-md);
        }
      `}</style>
        </form>
    )
}
