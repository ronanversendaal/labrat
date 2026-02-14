import { useState } from 'react';
import type { TestReport, TestSuite, TestCase } from '../../types';
import { useTestReport } from '../../hooks/usePipeline';
import { Skeleton } from '../common/Skeleton';

interface TestReportPanelProps {
  projectId: number;
  pipelineId: number;
}

export function TestReportPanel({ projectId, pipelineId }: TestReportPanelProps) {
  const { data: report, isLoading, error } = useTestReport(projectId, pipelineId);

  if (isLoading) {
    return (
      <div className="border border-edge rounded-lg p-4">
        <Skeleton variant="text" width="50%" height="1rem" className="mb-3" />
        <Skeleton.Text lines={3} />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="border border-edge rounded-lg p-6 text-center text-content-secondary text-sm">
        {error ? 'Failed to load test report.' : 'No test report available.'}
      </div>
    );
  }

  return (
    <div className="border border-edge rounded-lg overflow-hidden">
      <SummaryBar report={report} />
      <div className="divide-y divide-edge">
        {report.test_suites.map((suite, idx) => (
          <TestSuiteSection key={`${suite.name}-${idx}`} suite={suite} />
        ))}
      </div>
    </div>
  );
}

function SummaryBar({ report }: { report: TestReport }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-edge flex-wrap">
      <span className="text-sm font-semibold text-content">Test Report</span>
      <div className="flex items-center gap-2 ml-auto">
        <CountBadge count={report.total_count} label="total" variant="default" />
        <CountBadge count={report.success_count} label="passed" variant="success" />
        <CountBadge count={report.failed_count} label="failed" variant="failed" />
        <CountBadge count={report.error_count} label="errors" variant="error" />
        <CountBadge count={report.skipped_count} label="skipped" variant="skipped" />
      </div>
      {report.total_time > 0 && (
        <span className="text-xs text-content-tertiary">
          {report.total_time.toFixed(2)}s
        </span>
      )}
    </div>
  );
}

function CountBadge({
  count,
  label,
  variant,
}: {
  count: number;
  label: string;
  variant: 'default' | 'success' | 'failed' | 'error' | 'skipped';
}) {
  if (count === 0 && variant !== 'default') return null;

  const classes: Record<typeof variant, string> = {
    default: 'bg-surface-alt text-content-secondary',
    success: 'bg-positive-muted text-positive-text',
    failed: 'bg-negative-muted text-negative-text',
    error: 'bg-negative-muted text-negative-text',
    skipped: 'bg-surface-alt text-content-tertiary',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${classes[variant]}`}>
      <span>{count}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

function TestSuiteSection({ suite }: { suite: TestSuite }) {
  const [expanded, setExpanded] = useState(suite.failed_count > 0 || suite.error_count > 0);

  const hasFailing = suite.failed_count > 0 || suite.error_count > 0;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-surface-hover transition-colors"
      >
        <ChevronIcon expanded={expanded} />
        <span className={`text-sm font-medium ${hasFailing ? 'text-negative' : 'text-content'}`}>
          {suite.name}
        </span>
        <div className="flex items-center gap-1.5 ml-auto text-xs">
          {suite.success_count > 0 && (
            <span className="text-positive">{suite.success_count} passed</span>
          )}
          {suite.failed_count > 0 && (
            <span className="text-negative">{suite.failed_count} failed</span>
          )}
          {suite.error_count > 0 && (
            <span className="text-negative">{suite.error_count} errors</span>
          )}
          {suite.skipped_count > 0 && (
            <span className="text-content-tertiary">{suite.skipped_count} skipped</span>
          )}
          {suite.total_time > 0 && (
            <span className="text-content-tertiary">{suite.total_time.toFixed(2)}s</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-edge-subtle">
          {suite.test_cases.map((tc, idx) => (
            <TestCaseRow key={`${tc.classname}-${tc.name}-${idx}`} testCase={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

function TestCaseRow({ testCase }: { testCase: TestCase }) {
  const [showOutput, setShowOutput] = useState(false);
  const hasOutput = testCase.system_output || testCase.stack_trace;
  const isFailing = testCase.status === 'failed' || testCase.status === 'error';

  return (
    <div>
      <div
        role={hasOutput ? 'button' : undefined}
        tabIndex={hasOutput ? 0 : undefined}
        onClick={hasOutput ? () => setShowOutput(!showOutput) : undefined}
        onKeyDown={hasOutput ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowOutput(!showOutput);
          }
        } : undefined}
        className={`
          flex items-center gap-2 px-4 py-1.5 pl-8 text-sm
          ${hasOutput ? 'hover:bg-surface-hover cursor-pointer' : ''}
        `}
      >
        <TestCaseStatusIcon status={testCase.status} />
        <span className={`flex-1 min-w-0 truncate ${isFailing ? 'text-negative' : 'text-content'}`}>
          {testCase.name}
        </span>
        {testCase.classname && (
          <span className="text-xs text-content-tertiary truncate max-w-[200px]" title={testCase.classname}>
            {testCase.classname}
          </span>
        )}
        {testCase.execution_time > 0 && (
          <span className="flex-shrink-0 text-xs text-content-tertiary tabular-nums">
            {testCase.execution_time.toFixed(2)}s
          </span>
        )}
        {hasOutput && <ChevronIcon expanded={showOutput} />}
      </div>

      {showOutput && hasOutput && (
        <div className="mx-4 ml-8 mb-2 rounded-md border border-edge overflow-hidden">
          {testCase.system_output && (
            <pre className="p-3 text-xs font-code text-content-secondary bg-surface-inset whitespace-pre-wrap break-words overflow-x-auto">
              {testCase.system_output}
            </pre>
          )}
          {testCase.stack_trace && (
            <pre className="p-3 text-xs font-code text-negative bg-surface-inset whitespace-pre-wrap break-words overflow-x-auto border-t border-edge">
              {testCase.stack_trace}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function TestCaseStatusIcon({ status }: { status: TestCase['status'] }) {
  const config: Record<TestCase['status'], { color: string; symbol: string }> = {
    success: { color: 'text-positive', symbol: '\u2713' },
    failed: { color: 'text-negative', symbol: '\u2717' },
    error: { color: 'text-negative', symbol: '!' },
    skipped: { color: 'text-content-tertiary', symbol: '-' },
  };

  const c = config[status];
  return (
    <span className={`flex-shrink-0 w-4 text-center text-xs font-bold ${c.color}`}>
      {c.symbol}
    </span>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-content-tertiary flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
