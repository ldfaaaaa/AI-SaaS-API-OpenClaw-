import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowWebSocket } from '../hooks/useWorkflowWebSocket';

export type StepStatus = 'waiting' | 'running' | 'completed' | 'failed';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  startTime?: string;
  endTime?: string;
  duration?: number;
  error?: string;
}

export interface WorkflowProgressProps {
  taskId: string;
  userId: string;
  onComplete?: (downloadUrl: string) => void;
}

const statusConfig = {
  waiting: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    icon: '⏱️',
    label: '等待中',
  },
  running: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    icon: '🔄',
    label: '执行中',
  },
  completed: {
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    icon: '✅',
    label: '已完成',
  },
  failed: {
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    icon: '❌',
    label: '失败',
  },
};

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  taskId,
  userId,
  onComplete,
}) => {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [overallStatus, setOverallStatus] = useState<'running' | 'completed' | 'failed'>('running');

  const { isConnected, lastMessage } = useWorkflowWebSocket(userId);

  useEffect(() => {
    if (!lastMessage) return;

    const { event, payload } = lastMessage;

    // 处理工作流进度更新
    if (event === 'workflow.progress' && payload.taskId === taskId) {
      setSteps(payload.steps as WorkflowStep[]);
    }

    // 处理步骤更新
    if (event === 'workflow.step.update' && payload.taskId === taskId) {
      setSteps((prevSteps) =>
        prevSteps.map((step) =>
          step.id === payload.stepId
            ? {
                ...step,
                status: payload.status as StepStatus,
                startTime: payload.startTime,
                endTime: payload.endTime,
                duration: payload.duration,
                error: payload.error,
              }
            : step
        )
      );
    }

    // 处理工作流完成
    if (event === 'workflow.completed' && payload.taskId === taskId) {
      setOverallStatus('completed');
      setDownloadUrl(payload.downloadUrl as string);
      onComplete?.(payload.downloadUrl as string);
    }

    // 处理工作流失败
    if (event === 'workflow.failed' && payload.taskId === taskId) {
      setOverallStatus('failed');
    }
  }, [lastMessage, taskId, onComplete]);

  const formatDuration = (ms?: number): string => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* 头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">工作流执行进度</h2>
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-600">
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">Task ID: {taskId}</p>
      </div>

      {/* 步骤列表 */}
      <div className="space-y-4">
        <AnimatePresence>
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`relative p-4 rounded-lg border-2 ${
                step.status === 'running' ? 'border-blue-500' : 'border-gray-200'
              } ${statusConfig[step.status].bgColor}`}
            >
              {/* 连接线 */}
              {index < steps.length - 1 && (
                <div className="absolute left-8 top-full w-0.5 h-4 bg-gray-300" />
              )}

              <div className="flex items-start space-x-4">
                {/* 图标 */}
                <motion.div
                  animate={
                    step.status === 'running'
                      ? { rotate: 360 }
                      : { rotate: 0 }
                  }
                  transition={
                    step.status === 'running'
                      ? { duration: 2, repeat: Infinity, ease: 'linear' }
                      : {}
                  }
                  className="text-2xl"
                >
                  {statusConfig[step.status].icon}
                </motion.div>

                {/* 内容 */}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">{step.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig[step.status].color}`}
                    >
                      {statusConfig[step.status].label}
                    </span>
                  </div>

                  {/* 时间信息 */}
                  <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
                    {step.startTime && (
                      <span>开始: {new Date(step.startTime).toLocaleTimeString()}</span>
                    )}
                    {step.endTime && (
                      <span>结束: {new Date(step.endTime).toLocaleTimeString()}</span>
                    )}
                    {step.duration !== undefined && (
                      <span className="font-medium">
                        耗时: {formatDuration(step.duration)}
                      </span>
                    )}
                  </div>

                  {/* 错误信息 */}
                  {step.error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-700"
                    >
                      错误: {step.error}
                    </motion.div>
                  )}

                  {/* 进度条 */}
                  {step.status === 'running' && (
                    <motion.div
                      className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className="h-full bg-blue-500"
                        animate={{ x: ['0%', '100%'] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                        style={{ width: '30%' }}
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 完成后的下载按钮 */}
      <AnimatePresence>
        {overallStatus === 'completed' && downloadUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-6"
          >
            <button
              onClick={handleDownload}
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <span className="flex items-center justify-center space-x-2">
                <span>📥</span>
                <span>下载结果</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 失败状态 */}
      {overallStatus === 'failed' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-center"
        >
          <p className="text-red-600 font-medium">工作流执行失败</p>
          <p className="text-sm text-red-500 mt-1">请检查错误信息并重试</p>
        </motion.div>
      )}
    </div>
  );
};
